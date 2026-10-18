// Délai max d'un appel à un fournisseur IA (LLM_TIMEOUT_MS, 3 min par défaut).
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 180_000;

export function llmSignal(ms = LLM_TIMEOUT_MS) {
  return AbortSignal.timeout(ms);
}
