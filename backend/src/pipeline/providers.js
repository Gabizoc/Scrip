import { runOCR } from './ocr.js';
import { structureContent } from './structure.js';
import { runVisionPipeline } from './vision.js';
import { runGoogleVisionPipeline } from './google-vision.js';
import { runOllamaPipeline, isOllamaConfigured, pingOllama } from './ollama.js';
import { isOutputValid, applyRulesFormat } from './format-rules.js';

export const PIPELINE_MODE = process.env.PIPELINE_MODE ?? 'auto';

function keys() {
  return {
    googleKey:     process.env.GOOGLE_API_KEY,
    mistralKey:    process.env.MISTRAL_API_KEY,
    nvidiaKey:     process.env.NVIDIA_API_KEY,
    openrouterKey: process.env.OPENROUTER_API_KEY,
  };
}

const stripFences = (text) => text
  .replace(/^```(?:markdown)?\s*\n?/i, '')
  .replace(/\n?```\s*$/i, '')
  .replace(/\n*<!--\s*METADATA[\s\S]*?-->\s*$/i, '')
  .trim();

// Chaque fournisseur renvoie { rawMarkdown, rawStructured, imageRegions, detail, usedFallback, fallbackWarning }.
// rawMarkdown sert de référence (texte lu), rawStructured est le Markdown final avant mise en forme.
const PROVIDERS = {
  ollama: {
    label: 'Analyse Ollama',
    isConfigured: () => isOllamaConfigured(),
    missingConfig: 'OLLAMA_BASE_URL ou OLLAMA_API_KEY manquante dans le .env (requis pour PIPELINE_MODE=ollama)',
    async run(imagePaths, { userNote, systemPrompt }) {
      const r = await runOllamaPipeline(imagePaths, { userNote, systemPrompt });
      return { rawMarkdown: r.rawMarkdown, rawStructured: r.rawMarkdown, imageRegions: r.imageRegions, detail: r.modelUsed ?? 'ollama' };
    },
  },

  google: {
    label: 'Analyse Gemini',
    isConfigured: () => !!keys().googleKey,
    missingConfig: 'GOOGLE_API_KEY manquante dans le .env (requis pour PIPELINE_MODE=google)',
    async run(imagePaths, { userNote, systemPrompt }) {
      const r = await runGoogleVisionPipeline(imagePaths, { ...keys(), userNote, systemPrompt });
      return {
        rawMarkdown: r.rawMarkdown,
        rawStructured: r.rawMarkdown,
        imageRegions: r.imageRegions,
        detail: r.usedFallback ? 'mise en forme automatique' : `Gemini ${r.modelUsed ?? ''}`.trim(),
        usedFallback: !!r.usedFallback,
        fallbackWarning: 'Gemini indisponible ou rejeté — mise en forme automatique utilisée. La note peut nécessiter une relecture.',
      };
    },
  },

  nvidia: {
    label: 'Analyse NVIDIA',
    isConfigured: () => !!keys().nvidiaKey,
    missingConfig: 'NVIDIA_API_KEY manquante dans le .env (requis pour PIPELINE_MODE=nvidia)',
    async run(imagePaths, { userNote, systemPrompt }) {
      const { nvidiaKey, mistralKey } = keys();
      const r = await runVisionPipeline(imagePaths, { nvidiaKey, mistralKey, userNote, systemPrompt });
      return {
        rawMarkdown: r.rawMarkdown,
        rawStructured: r.rawMarkdown,
        imageRegions: r.imageRegions,
        detail: r.usedFallback ? 'mise en forme automatique' : 'NVIDIA vision',
        usedFallback: !!r.usedFallback,
        fallbackWarning: 'Modèle vision indisponible — mise en forme automatique utilisée. La note peut nécessiter une relecture.',
      };
    },
  },

  mistral: {
    label: 'OCR Mistral',
    isConfigured: () => !!keys().mistralKey,
    missingConfig: 'MISTRAL_API_KEY manquante dans le .env (requis pour PIPELINE_MODE=mistral)',
    async run(imagePaths, { systemPrompt }) {
      const { mistralKey, openrouterKey, nvidiaKey } = keys();
      const ocr = await runOCR(imagePaths, mistralKey);
      const rawStructured = await structureContent(ocr.rawMarkdown, { systemPrompt, openrouterKey, nvidiaKey });
      const usedFallback = !isOutputValid(ocr.rawMarkdown, stripFences(rawStructured));
      return {
        rawMarkdown: ocr.rawMarkdown,
        rawStructured: usedFallback ? applyRulesFormat(ocr.rawMarkdown) : rawStructured,
        imageRegions: ocr.imageRegions,
        detail: usedFallback ? 'mise en forme automatique' : 'Mistral + LLM',
        usedFallback,
        fallbackWarning: 'Structuration LLM rejetée (validation échouée) — mise en forme automatique utilisée. La note peut nécessiter une relecture.',
      };
    },
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
