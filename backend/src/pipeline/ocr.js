import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const MISTRAL_CHAT_ENDPOINT = 'https://api.mistral.ai/v1/chat/completions';
const VISION_MODEL = 'pixtral-large-latest';

// Redimensionne l'image à max 1600px et qualité 80 pour rester sous les limites de tokens
export async function prepareImage(imagePath) {
  const ext = path.extname(imagePath).toLowerCase().replace('.', '');
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const buffer = await sharp(imagePath)
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  console.log('[DEBUG ocr] image redimensionnée :', buffer.length, 'bytes (mime: image/jpeg)');
  return { base64: buffer.toString('base64'), mimeType: 'image/jpeg' };
}

// Retry avec backoff exponentiel sur 429
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);
    if (res.status !== 429) return res;

    const wait = attempt * 15_000; // 15s, 30s, 45s
    console.log(`[DEBUG ocr] 429 rate limit — attente ${wait / 1000}s (tentative ${attempt}/${maxRetries})`);
    await new Promise(r => setTimeout(r, wait));
  }
  return fetch(url, options); // dernière tentative
}

const SYSTEM_PROMPT = `Tu es un moteur d'OCR. Lis ce qui est ÉCRIT dans l'image, mot par mot.

RÈGLES STRICTES :
- Transcris uniquement les mots physiquement visibles dans l'image
- N'invente RIEN, ne complète RIEN, ne déduis RIEN
- Si un mot est illisible → écris [illisible]
- Si une zone est floue → écris [zone illisible]

TABLEAUX : si tu vois un tableau dans l'image, reproduis-le en Markdown :
| Colonne 1 | Colonne 2 | Colonne 3 |
|-----------|-----------|-----------|
| cellule   | cellule   | cellule   |
Chaque cellule = uniquement ce qui est écrit dans cette cellule, rien d'autre.

INTERDIT :
- Compléter des informations partielles avec tes connaissances
- Ajouter des classements, rangs, statistiques ou faits non visibles
- Reformuler ou résumer
- Produire des listes si le texte n'en contient pas

FORMAT : texte brut, sans balises \`\`\`markdown\`\`\`. Commence directement par le texte.`;

/**
 * OCR d'une ou plusieurs pages en un seul appel Mistral.
 * Toutes les images sont envoyées dans le même message → le modèle voit le document entier.
 *
 * @param {string | string[]} imagePaths
 * @param {string} apiKey
 * @returns {Promise<{ rawMarkdown: string, imageRegions: [] }>}
 */
export async function runOCR(imagePaths, apiKey) {
  const paths = Array.isArray(imagePaths) ? imagePaths : [imagePaths];

  console.log('[DEBUG ocr] modèle :', VISION_MODEL);
  console.log('[DEBUG ocr] apiKey reçue :', apiKey ? apiKey.slice(0, 8) + '...' : 'UNDEFINED/NULL');
  console.log('[DEBUG ocr] pages :', paths.length);

  // Préparer toutes les images
  const images = await Promise.all(paths.map(prepareImage));

  // Construire le contenu multi-images : image1, image2…, puis instruction texte
  const userContent = [
    ...images.map(({ base64, mimeType }, i) => ({
      type: 'image_url',
      image_url: { url: `data:${mimeType};base64,${base64}` },
    })),
    {
      type: 'text',
      text: paths.length === 1
        ? 'Transcris intégralement le texte de cette image.'
        : `Transcris intégralement le texte de ces ${paths.length} pages dans l'ordre. Sépare chaque page par "---".`,
    },
  ];

  const response = await fetchWithRetry(MISTRAL_CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0,
      max_tokens: 4096 * Math.min(paths.length, 3), // plus de tokens pour plus de pages
    }),
  });

  console.log('[DEBUG ocr] réponse HTTP :', response.status, response.statusText);
  if (!response.ok) {
    const errorText = await response.text();
    console.log('[DEBUG ocr] corps erreur :', errorText);
    throw new Error(`Mistral OCR erreur ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  // Supprimer les éventuelles fences Markdown que le modèle ajouterait malgré l'instruction
  const raw = data.choices[0].message.content
    .replace(/^```(?:markdown)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
  const rawMarkdown = deduplicateOCR(raw);
  return { rawMarkdown, imageRegions: [] };
}

/**
 * Supprime les répétitions en boucle typiques des hallucinations OCR (pixtral).
 *
 * Stratégies :
 *  1. Lignes consécutives identiques → 0 doublon
 *  2. Phrases répétées en regex (même phrase ≥ 2 fois)
 *  3. Fenêtre glissante : si un bloc de N lignes se répète dans les 2×N suivantes → tronquer
 */
export function deduplicateOCR(text) {
  const originalLen = text.length;

  // ── Étape 1 : lignes consécutives identiques ──────────────────────────────
  const lines = text.split('\n');
  const step1 = [];
  let lastLine = null;
  for (const line of lines) {
    const t = line.trim();
    if (t !== lastLine) { step1.push(line); lastLine = t; }
  }

  // ── Étape 2 : phrases répétées dans un paragraphe ─────────────────────────
  let step2 = step1.join('\n');
  step2 = step2
    .replace(/([^.!?\n]{15,}[.!?])\s*(\1\s*){1,}/g, '$1') // phrase. phrase.
    .replace(/(\b\w{4,}\b)(\s+\1){2,}/g, '$1');            // mot mot mot

  // ── Étape 3 : fenêtre glissante sur les lignes (anti-boucle sur blocs) ────
  const lines2 = step2.split('\n');
  const WINDOW = 4; // taille du bloc à surveiller
  const step3 = [];
  let i = 0;
  while (i < lines2.length) {
    step3.push(lines2[i]);
    // Vérifie si le bloc [i-WINDOW+1 .. i] se répète immédiatement après
    if (step3.length >= WINDOW) {
      const block = step3.slice(-WINDOW).map(l => l.trim()).join('\n');
      const ahead = lines2.slice(i + 1, i + 1 + WINDOW).map(l => l.trim()).join('\n');
      if (block === ahead && block.length > 20) {
        // Saute la répétition
        i += WINDOW;
        process.stderr.write(`[OCR] bloc répété détecté (fenêtre ${WINDOW}) → sauté\n`);
        continue;
      }
    }
    i++;
  }

  // ── Étape 4 : extension additive de préfixe (pixtral hallucination pattern) ─
  // Détecte les séquences où chaque ligne est le préfixe de la suivante avec
  // du texte supplémentaire : "phrase A" → "phrase A + B" → "phrase A + B + C"
  // Conserve uniquement la dernière (la plus longue) version.
  const step4 = [];
  let k = 0;
  while (k < step3.length) {
    const cur = step3[k].trim();
    if (
      cur.length >= 30 &&
      k + 1 < step3.length &&
      !cur.startsWith('#') && !cur.startsWith('|') && !cur.startsWith('>')
    ) {
      const next = step3[k + 1].trim();
      if (next.startsWith(cur) && next.length >= cur.length + 6) {
        // Début d'une chaîne additive — cherche la fin
        let j = k + 1;
        while (
          j + 1 < step3.length &&
          step3[j + 1].trim().startsWith(step3[j].trim()) &&
          step3[j + 1].trim().length >= step3[j].trim().length + 6
        ) {
          j++;
        }
        step4.push(step3[j]);
        process.stderr.write(`[OCR] extension additive (${j - k + 1} lignes) → conservé la plus longue\n`);
        k = j + 1;
        continue;
      }
    }
    step4.push(step3[k]);
    k++;
  }

  const result = step4.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  const removed = originalLen - result.length;
  if (removed > 50) {
    process.stderr.write(`[OCR] déduplication : ${removed} chars supprimés (${originalLen} → ${result.length})\n`);
  }

  return result;
}

export async function prepareImageSmall(imagePath) {
  const buffer = await sharp(imagePath)
    .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 55 })
    .toBuffer();
  return { base64: buffer.toString('base64'), mimeType: 'image/jpeg' };
}
