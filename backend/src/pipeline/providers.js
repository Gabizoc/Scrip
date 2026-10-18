import { log } from '../lib/logger.js';
import { runOCR } from './ocr.js';
import { structureContent } from './structure.js';
import { runVisionTranscription } from './vision.js';
import { runGoogleTranscription, geminiStructure } from './google-vision.js';
import { runOllamaTranscription, ollamaChat, isOllamaConfigured, pingOllama } from './ollama.js';
import { buildStructureMessages, structureMaxTokens, finalizeStructure } from './transcribe.js';

export const PIPELINE_MODE = process.env.PIPELINE_MODE ?? 'auto';

function keys() {
  return {
    googleKey:     process.env.GOOGLE_API_KEY,
    mistralKey:    process.env.MISTRAL_API_KEY,
    nvidiaKey:     process.env.NVIDIA_API_KEY,
    openrouterKey: process.env.OPENROUTER_API_KEY,
  };
}

// Passe 2 : structure la transcription avec le modèle texte du fournisseur, puis NVIDIA/OpenRouter
// en secours si leurs clés sont définies. Renvoie null si aucun modèle n'a répondu.
async function structureText(messages, maxTokens, primary) {
  const { openrouterKey, nvidiaKey } = keys();
  if (primary) {
    try {
      const out = await primary(messages, maxTokens);
      if (out) return out;
    } catch (err) {
      log.warn(`⚠ structuration échouée (${err.message})`);
    }
  }
  if (!openrouterKey && !nvidiaKey) return null;
  try {
    return await structureContent(messages, { openrouterKey, nvidiaKey, maxTokens });
  } catch (err) {
    log.warn(`⚠ structuration NVIDIA/OpenRouter échouée (${err.message})`);
    return null;
  }
}

// Enchaîne les deux passes et renvoie { rawMarkdown, rawStructured, imageRegions, detail, usedFallback, fallbackWarning }.
// rawMarkdown est la transcription (texte lu), rawStructured le Markdown final avant mise en forme.
async function twoPass({ transcribe, structure, label }, imagePaths, ctx) {
  const { transcription, usedFallback: readFallback, detail } = await transcribe(imagePaths, ctx);
  const messages = buildStructureMessages(transcription, ctx);
  const structured = await structureText(messages, structureMaxTokens(transcription), structure);
  const { rawStructured, usedFallback: formatFallback } = finalizeStructure(transcription, structured);
  return {
    rawMarkdown: transcription,
    rawStructured,
    imageRegions: [],
    detail: formatFallback ? 'mise en forme automatique' : (detail ?? label),
    usedFallback: !!(readFallback || formatFallback),
    fallbackWarning: formatFallback
      ? 'Structuration indisponible ou rejetée — mise en forme automatique utilisée. La note peut nécessiter une relecture.'
      : 'Les deux lectures des photos ne concordent pas — la note peut nécessiter une relecture.',
  };
}

const PROVIDERS = {
  ollama: {
    label: 'Analyse Ollama',
    isConfigured: () => isOllamaConfigured(),
    missingConfig: 'OLLAMA_BASE_URL ou OLLAMA_API_KEY manquante dans le .env (requis pour PIPELINE_MODE=ollama)',
    run: (imagePaths, ctx) => twoPass({
      label: 'ollama',
      transcribe: async (paths, c) => {
        const r = await runOllamaTranscription(paths, c);
        return { transcription: r.transcription, detail: r.modelUsed };
      },
      structure: (messages, maxTokens) => ollamaChat(messages, maxTokens),
    }, imagePaths, ctx),
  },

  google: {
    label: 'Analyse Gemini',
    isConfigured: () => !!keys().googleKey,
    missingConfig: 'GOOGLE_API_KEY manquante dans le .env (requis pour PIPELINE_MODE=google)',
    run: (imagePaths, ctx) => twoPass({
      label: 'Gemini',
      transcribe: async (paths, c) => {
        const r = await runGoogleTranscription(paths, { ...c, googleKey: keys().googleKey });
        return { ...r, detail: `Gemini ${r.modelUsed ?? ''}`.trim() };
      },
      structure: (messages, maxTokens) => geminiStructure(messages, keys().googleKey, maxTokens),
    }, imagePaths, ctx),
  },

  nvidia: {
    label: 'Analyse NVIDIA',
    isConfigured: () => !!keys().nvidiaKey,
    missingConfig: 'NVIDIA_API_KEY manquante dans le .env (requis pour PIPELINE_MODE=nvidia)',
    run: (imagePaths, ctx) => twoPass({
      label: 'NVIDIA vision',
      transcribe: (paths, c) => {
        const { nvidiaKey, mistralKey } = keys();
        return runVisionTranscription(paths, { ...c, nvidiaKey, mistralKey });
      },
    }, imagePaths, ctx),
  },

  mistral: {
    label: 'OCR Mistral',
    isConfigured: () => !!keys().mistralKey,
    missingConfig: 'MISTRAL_API_KEY manquante dans le .env (requis pour PIPELINE_MODE=mistral)',
    run: (imagePaths, ctx) => twoPass({
      label: 'Mistral + LLM',
      transcribe: async (paths, c) => ({ transcription: (await runOCR(paths, keys().mistralKey, c)).rawMarkdown }),
    }, imagePaths, ctx),
  },
};

const AUTO_ORDER = ['ollama', 'google', 'nvidia', 'mistral'];

// Vérifie la configuration avant d'accepter une ingestion. Renvoie un message d'erreur ou null.
export function checkPipelineConfig() {
  if (PIPELINE_MODE === 'auto') {
    return AUTO_ORDER.some(m => PROVIDERS[m].isConfigured())
      ? null
      : 'Mode auto : aucun fournisseur configuré (OLLAMA_BASE_URL/OLLAMA_API_KEY, GOOGLE_API_KEY, NVIDIA_API_KEY ou MISTRAL_API_KEY requis)';
  }
  const provider = PROVIDERS[PIPELINE_MODE];
  if (!provider) return `PIPELINE_MODE inconnu : "${PIPELINE_MODE}" (valeurs possibles : auto, ${AUTO_ORDER.join(', ')})`;
  return provider.isConfigured() ? null : provider.missingConfig;
}

export async function selectProvider() {
  if (PIPELINE_MODE !== 'auto') return PIPELINE_MODE;
  if (await pingOllama()) return 'ollama';
  return AUTO_ORDER.slice(1).find(m => PROVIDERS[m].isConfigured()) ?? 'google';
}

export function getProvider(mode) {
  return PROVIDERS[mode];
}
