import { log } from '../lib/logger.js';
import { prepareImage, preparePages } from './image.js';
import { buildTranscriptionPrompt, buildTranscriptionContent, finishTranscription, cleanFences, hasRepetitionLoop } from './transcribe.js';

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
const CLOUD_BASE_URL = 'https://ollama.com';
const DEFAULT_MODEL = 'gemma4:31b-cloud';

// Ollama Cloud (https://docs.ollama.com/cloud) : appel direct a ollama.com avec OLLAMA_API_KEY,
// sans installation locale. Si seule la cle est definie, on bascule automatiquement sur le cloud.
export function getOllamaConfig() {
  const apiKey = process.env.OLLAMA_API_KEY || null;
  const baseUrl = (process.env.OLLAMA_BASE_URL || (apiKey ? CLOUD_BASE_URL : DEFAULT_BASE_URL)).replace(/\/$/, '');
  const direct = /^https?:\/\/(www\.)?ollama\.com$/i.test(baseUrl);
  let model = process.env.OLLAMA_MODEL || DEFAULT_MODEL;
  // L'API ollama.com attend le nom brut (gemma4:31b), pas la variante CLI (gemma4:31b-cloud / gemma4:cloud)
  if (direct) model = model.replace(/-cloud$/, '').replace(/:cloud$/, '');
  return { apiKey, baseUrl, model, direct, isCloud: direct || /[:-]cloud$/.test(model) };
}

export function isOllamaConfigured() {
  return !!(process.env.OLLAMA_BASE_URL || process.env.OLLAMA_API_KEY);
}

export async function pingOllama(timeoutMs = 2000) {
  if (!isOllamaConfigured()) return false;
  const { baseUrl, apiKey } = getOllamaConfig();
  try {
    const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
    const r = await fetch(`${baseUrl}/api/tags`, { headers, signal: AbortSignal.timeout(timeoutMs) });
    return r.ok;
  } catch {
    return false;
  }
}

// Nouvel essai après une boucle : un peu d'aléa et une pénalité de répétition l'en font sortir.
const LOOP_RETRY_OPTIONS = { temperature: 0.4, repeat_penalty: 1.15 };
// Fréquence (en caractères reçus) de la recherche de boucle pendant le streaming.
const LOOP_CHECK_EVERY = 1500;

async function callOllama(messages, model, baseUrl, maxTokens, extraOptions = {}) {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/api/chat`;

  const headers = { 'Content-Type': 'application/json' };
  const { apiKey } = getOllamaConfig();
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const ollamaMessages = messages.map(msg => {
    if (typeof msg.content === 'string') return { role: msg.role, content: msg.content };
    const texts = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    const images = msg.content
      .filter(b => b.type === 'image_url')
      .map(b => {
        const url = b.image_url?.url ?? '';
        return url.includes(',') ? url.split(',')[1] : url;
      });
    return { role: msg.role, content: texts, ...(images.length ? { images } : {}) };
  });

  const imageCount = ollamaMessages.reduce((n, m) => n + (m.images?.length ?? 0), 0);
  const idleTimeoutMs = Math.min(180_000 + imageCount * 30_000, 600_000);

  const body = JSON.stringify({
    model,
    options: { temperature: 0, num_predict: maxTokens, ...extraOptions },
    messages: ollamaMessages,
    stream: true,
  });

  log.debug(`[debug] POST ${endpoint} — model=${model} body=${body.length}B stream (timeout inactivité ${Math.round(idleTimeoutMs / 1000)}s)`);

  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), idleTimeoutMs);
  const bumpTimeout = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), idleTimeoutMs);
  };

  let res;
  try {
    res = await fetch(endpoint, { method: 'POST', headers, body, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    log.warn(`[debug] fetch ERREUR réseau: ${err.message}`);
    throw err;
  }

  log.debug(`[debug] HTTP ${res.status} ${res.statusText}`);

  if (res.status === 429) {
    clearTimeout(timer);
    log.debug(`[debug] 429 rate-limit`);
    return null;
  }

  if (!res.ok) {
    clearTimeout(timer);
    const txt = await res.text();
    log.warn(`[debug] réponse erreur: ${txt.slice(0, 500)}`);
    if (res.status === 401) {
      const hint = apiKey
        ? `cle OLLAMA_API_KEY refusee (${apiKey.slice(0, 4)}…, ${apiKey.length} chars) — verifie-la sur https://ollama.com/settings/keys et redemarre le backend apres modification du .env`
        : 'OLLAMA_API_KEY manquante dans le .env';
      throw new Error(`Ollama 401 : ${hint}`);
    }
    if (res.status === 404) {
      log.warn(`⚠ Ollama modèle "${model}" introuvable — vérifie que le modèle est installé (ollama pull ${model})`);
      return null;
    }
    throw new Error(`Ollama erreur ${res.status}: ${txt}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let checkedAt = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bumpTimeout();
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let obj;
        try { obj = JSON.parse(line); } catch { continue; }
        if (obj.error) throw new Error(`Ollama: ${typeof obj.error === 'string' ? obj.error : JSON.stringify(obj.error)}`);
        if (obj.message?.content) content += obj.message.content;
      }
      // Coupe le flux dès qu'une boucle apparaît plutôt que d'attendre num_predict tokens.
      if (content.length - checkedAt >= LOOP_CHECK_EVERY) {
        checkedAt = content.length;
        if (hasRepetitionLoop(content)) {
          log.warn(`⚠ Ollama ${model} : boucle de répétition détectée → génération interrompue`);
          await reader.cancel().catch(() => {});
          break;
        }
      }
    }
    const last = buffer.trim();
    if (last) {
      try { const obj = JSON.parse(last); if (obj.message?.content) content += obj.message.content; }
      catch { /* */ }
    }
  } catch (err) {
    log.warn(`[debug] erreur lecture stream: ${err.message}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }

  log.debug(`[debug] réponse reçue (stream): ${content.length} chars`);
  return content || null;
}

// Transcrit une requête ; si le modèle part en boucle, réessaie une fois avec d'autres réglages.
async function transcribeOnce(messages, model, baseUrl, maxTokens) {
  const first = await callOllama(messages, model, baseUrl, maxTokens);
  if (!first || !hasRepetitionLoop(first)) return { raw: first, looped: false };
  log.warn(`↻ ${model} : nouvel essai après une boucle de répétition`);
  const second = await callOllama(messages, model, baseUrl, maxTokens, LOOP_RETRY_OPTIONS);
  if (second && !hasRepetitionLoop(second)) return { raw: second, looped: false };
  return { raw: first, looped: true };
}

export async function callOllamaRaw(imagePaths) {
  // Lecture de référence, toutes pages en une requête : taille modérée pour le payload.
  const images = await Promise.all(imagePaths.map(p => prepareImage(p, { maxSide: 1200, quality: 75 })));
  const { baseUrl, model } = getOllamaConfig();

  const messages = [
    {
      role: 'system',
      content: 'Tu lis le texte manuscrit des images et tu le retranscris tel quel, sans mise en forme. Copie uniquement ce qui est écrit.',
    },
    {
      role: 'user',
      content: [
        ...images.map(({ base64, mimeType }, i) => [
          { type: 'text', text: images.length > 1 ? `Page ${i + 1} :` : '' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ]).flat().filter(b => b.text !== ''),
        { type: 'text', text: 'Transcris le texte manuscrit de ces images, mot pour mot.' },
      ],
    },
  ];

  log.debug(`→ Ollama validation (${model})`);
  try {
    const raw = await callOllama(messages, model, baseUrl, 4096);
    if (!raw) return null;
    const cleaned = cleanFences(raw);
    if (hasRepetitionLoop(cleaned)) {
      log.warn(`⚠ Ollama validation : boucle de répétition détectée → rejet`);
      return null;
    }
    log.debug(`✓ Ollama validation → ${cleaned.length} chars`);
    return cleaned;
  } catch (err) {
    log.warn(`⚠ Ollama validation échoué: ${err.message}`);
    return null;
  }
}

// Appel texte simple (sans image), utilisé par exemple pour le résumé.
export async function ollamaChat(messages, maxTokens = 512) {
  const { baseUrl, model } = getOllamaConfig();
  const raw = await callOllama(messages, model, baseUrl, maxTokens);
  return raw ? cleanFences(raw) : null;
}

// Transcription (passe 1). La structuration se fait ensuite sur le texte (cf. providers.js).
export async function runOllamaTranscription(imagePaths, { vocabulary, corrections, userNote } = {}) {
  const paths = Array.isArray(imagePaths) ? imagePaths : [imagePaths];
  const { baseUrl, model, isCloud } = getOllamaConfig();

  log.debug(`[ollama] ${paths.length} image(s), modèle: ${model}, endpoint: ${baseUrl}`);

  const system = { role: 'system', content: buildTranscriptionPrompt({ vocabulary, corrections, userNote }) };
  const unreachable = () => new Error(`Ollama: le modèle "${model}" est inaccessible sur ${baseUrl}. Vérifie qu'Ollama tourne et que le modèle est installé.`);

  if (isCloud) {
    // Modèles cloud : une page par requête pour rester sous la limite de payload du relay
    const parts = [];
    const loopedPages = [];
    for (let i = 0; i < paths.length; i++) {
      const pages = await preparePages([paths[i]]);
      const user = { role: 'user', content: buildTranscriptionContent(pages, { firstPage: i + 1, totalPages: paths.length }) };
      log.debug(`→ ${model} [${i + 1}/${paths.length}]`);
      const { raw, looped } = await transcribeOnce([system, user], model, baseUrl, 4096);
      if (!raw) throw unreachable();
      if (looped) loopedPages.push(i + 1);
      parts.push(finishTranscription(raw));
      log.debug(`✓ page ${i + 1}/${paths.length} → ${raw.length} chars`);
    }
    return { transcription: parts.join('\n\n'), modelUsed: model, loopedPages };
  }

  // Modèles locaux : toutes les pages en une seule requête
  const pages = await preparePages(paths);
  const user = { role: 'user', content: buildTranscriptionContent(pages) };
  log.debug(`→ ${model}`);
  const { raw, looped } = await transcribeOnce([system, user], model, baseUrl, Math.min(4096 * paths.length, 16384));
  if (!raw) throw unreachable();
  log.debug(`✓ Ollama ${model} → ${raw.length} chars`);
  return { transcription: finishTranscription(raw), modelUsed: model, loopedPages: looped ? paths.map((_, i) => i + 1) : [] };
}
