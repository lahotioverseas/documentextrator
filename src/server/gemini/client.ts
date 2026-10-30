// Gemini API access with automatic key / model failover and cooldown tracking.
import 'server-only';
import { GoogleGenAI } from '@google/genai';

export const CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite'
];

// API Key Manager with automatic failover and cooldown tracking
interface KeyState {
  key: string;
  label: string;
  keyId: string;
}

export function getConfiguredApiKeys(): KeyState[] {
  const candidates: { key: string | undefined; label: string }[] = [
    { key: process.env.GEMINI_API_KEY, label: 'Primary (GEMINI_API_KEY)' },
    { key: process.env.GOOGLE_API_KEY, label: 'Google API Key (GOOGLE_API_KEY)' },
    { key: process.env.API_KEY, label: 'AI Studio Key (API_KEY)' },
    { key: process.env.GEMINI_API_KEY_SECONDARY, label: 'Secondary (GEMINI_API_KEY_SECONDARY)' },
    { key: process.env.GEMINI_API_KEY_2, label: 'Backup (GEMINI_API_KEY_2)' },
    { key: process.env.GEMINI_BACKUP_API_KEY, label: 'Backup (GEMINI_BACKUP_API_KEY)' }
  ];

  const seen = new Set<string>();
  const validKeys: KeyState[] = [];

  for (const c of candidates) {
    if (c.key && typeof c.key === 'string' && c.key.trim().length > 0 && !seen.has(c.key.trim())) {
      const trimmed = c.key.trim();
      seen.add(trimmed);
      validKeys.push({
        key: trimmed,
        label: c.label,
        keyId: trimmed.slice(-6)
      });
    }
  }

  return validKeys;
}

// In-memory cooldown tracker per (keyId + model) and per (keyId).
// On Vercel this lives per function instance, which is enough to skip a key that just hit its quota.
const modelCooldownMap = new Map<string, number>();
const keyCooldownMap = new Map<string, number>();

export function keyStatuses() {
  const now = Date.now();
  return getConfiguredApiKeys().map(k => ({
    label: k.label,
    isActive: (keyCooldownMap.get(k.key) || 0) <= now
  }));
}

export function isKeyExhaustionError(errMsg: string): boolean {
  const lower = errMsg.toLowerCase();
  return (
    lower.includes('429') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('rate_limit') ||
    lower.includes('too many requests') ||
    lower.includes('exhausted') ||
    lower.includes('403') ||
    lower.includes('permission_denied')
  );
}

function extractRetryDelaySeconds(errMsg: string): number {
  const retryMatch = errMsg.match(/retry in\s+([\d.]+)\s*s/i) || errMsg.match(/retryDelay["']?\s*:\s*["']?(\d+)/i);
  if (retryMatch && retryMatch[1]) {
    const sec = parseFloat(retryMatch[1]);
    if (!isNaN(sec) && sec > 0) return Math.ceil(sec);
  }
  return 20; // default 20s cooldown
}

function getGeminiClientForKey(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callGeminiWithFallback(requestPayload: any): Promise<any> {
  const configuredKeys = getConfiguredApiKeys();
  if (configuredKeys.length === 0) {
    throw new Error('No Gemini API keys configured. Please set GEMINI_API_KEY or GEMINI_API_KEY_SECONDARY.');
  }

  const now = Date.now();
  // Sort keys: active keys first (cooldown expired), then by original order
  const availableKeys = [...configuredKeys].sort((a, b) => {
    const aCooldown = keyCooldownMap.get(a.keyId) || 0;
    const bCooldown = keyCooldownMap.get(b.keyId) || 0;
    const aActive = aCooldown <= now ? 0 : 1;
    const bActive = bCooldown <= now ? 0 : 1;
    return aActive - bActive;
  });

  let lastError: any = null;

  for (let kIdx = 0; kIdx < availableKeys.length; kIdx++) {
    const keyInfo = availableKeys[kIdx];
    const ai = getGeminiClientForKey(keyInfo.key);

    for (const model of CANDIDATE_MODELS) {
      const modelKeyId = `${keyInfo.keyId}_${model}`;
      const modelCooldown = modelCooldownMap.get(modelKeyId) || 0;
      if (modelCooldown > now) {
        // This specific model is in cooldown for this key, check next model
        continue;
      }

      // Prepare model-specific config (thinkingConfig is only supported on Gemini 3 series)
      const isGemini3 = model.startsWith('gemini-3');
      const preparedConfig = { ...(requestPayload.config || {}) };
      if (!isGemini3 && preparedConfig.thinkingConfig) {
        delete preparedConfig.thinkingConfig;
      }

      const callConfig = {
        ...requestPayload,
        config: preparedConfig,
        model
      };

      // Retry up to 2 times for transient errors
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent(callConfig);
          if (response && response.text) {
            // Clear cooldowns on success
            modelCooldownMap.delete(modelKeyId);
            keyCooldownMap.delete(keyInfo.keyId);
            return response;
          }
        } catch (err: any) {
          const errMsg = err?.message || String(err);
          console.warn(`[Gemini API] Key "${keyInfo.label}" using ${model} (attempt ${attempt}) failed: ${errMsg}`);
          lastError = err;

          // If Rate limited or Quota exceeded (429)
          if (isKeyExhaustionError(errMsg)) {
            const cooldownSec = extractRetryDelaySeconds(errMsg);
            console.warn(`[Gemini API] Model "${model}" on "${keyInfo.label}" rate-limited/exhausted. Setting ${cooldownSec}s cooldown for this model.`);
            modelCooldownMap.set(modelKeyId, Date.now() + (cooldownSec * 1000));
            // Immediately cascade to next candidate model on the same key!
            break;
          }

          // If 404 (model not found / deprecated), proceed immediately to next model
          if (errMsg.includes('404') || errMsg.includes('NOT_FOUND') || errMsg.includes('no longer available')) {
            break;
          }

          // If 503 (high demand / unavailable), wait with backoff and retry or try next model
          if (errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand')) {
            if (attempt < 2) {
              await wait(600 * attempt);
            } else {
              modelCooldownMap.set(modelKeyId, Date.now() + 10000);
            }
          }
        }
      }
    }
  }

  throw lastError || new Error('All configured Gemini API models and keys are currently experiencing temporary high traffic or rate limits.');
}

export function formatApiError(error: any, fallbackMessage: string) {
  const errMsg = error?.message || String(error);
  const isRateLimit = isKeyExhaustionError(errMsg) || errMsg.includes('503') || errMsg.includes('UNAVAILABLE');
  const retryAfter = extractRetryDelaySeconds(errMsg);

  return {
    success: false,
    isRateLimit,
    retryAfter,
    error: isRateLimit
      ? `The AI model is temporarily experiencing high traffic/quota limits. Please retry in a few seconds or use manual entry.`
      : (error?.message || fallbackMessage)
  };
}
