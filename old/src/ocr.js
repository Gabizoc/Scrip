// src/ocr.js
import fs from 'node:fs';
import path from 'node:path';

const MISTRAL_OCR_ENDPOINT = 'https://api.mistral.ai/v1/ocr';

/**
 * Envoie une image à Mistral OCR et retourne le texte brut + les régions d'images détectées.
 * @param {string} imagePath - Chemin vers le fichier image
 * @param {string} apiKey - Clé API Mistral
 * @returns {Promise<{ rawMarkdown: string, imageRegions: Array<{id:string, x1:number, y1:number, x2:number, y2:number}> }>}
 */
export async function runOCR(imagePath, apiKey) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  const ext = path.extname(imagePath).toLowerCase().replace('.', '');
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const response = await fetch(MISTRAL_OCR_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: {
        type: 'image_url',
        image_url: `data:${mimeType};base64,${base64}`,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral OCR erreur ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const rawMarkdown = data.pages.map((p) => p.markdown).join('\n\n');
  const imageRegions = data.pages.flatMap((p) =>
    (p.images ?? []).map((img) => ({
      id: img.id,
      x1: img.top_left_x,
      y1: img.top_left_y,
      x2: img.bottom_right_x,
      y2: img.bottom_right_y,
    }))
  );

  return { rawMarkdown, imageRegions };
}
