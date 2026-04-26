import {
  GoogleGenerativeAI,
  type GenerativeModel,
  type GenerationConfig,
} from '@google/generative-ai';
import { externalApiError } from '../../utils/errors.js';
import { checkGeminiQuota } from './ai.gemini.guard.js';

/**
 * Raw response returned by {@link callGemini}, exposing the generated text
 * along with token usage metadata for audit logging.
 */
export interface GeminiResponse {
  text: string;
  tokensInput: number;
  tokensOutput: number;
}

/** Optional per-call overrides forwarded to `generateContent`. */
export interface CallGeminiOptions {
  /**
   * Per-call generation config overrides. Merged on top of the model's
   * baseline config (set in {@link getModel}). Useful for forcing
   * `responseMimeType: 'application/json'` on calls that expect strict
   * JSON output, while leaving other calls (e.g. paragraph regeneration)
   * as plain text.
   */
  generationConfig?: Partial<GenerationConfig>;
}

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

/**
 * Returns the singleton Gemini generative model instance, lazily
 * constructing it from `GEMINI_API_KEY` / `GEMINI_MODEL` the first time
 * it is needed. Uses a creative-but-stable sampling profile tuned for
 * hypnosis script generation; per-call overrides (e.g. JSON response
 * mime type) can be supplied via {@link callGemini}.
 */
export function getModel(): GenerativeModel {
  if (!model) {
    const apiKey = process.env.GEMINI_API_KEY ?? '';
    if (!apiKey) {
      // Thrown as a typed AppError so callers can treat missing config as
      // a permanent failure and skip retry/backoff, rather than having to
      // pattern-match on the error message.
      throw externalApiError('gemini', 'GEMINI_API_KEY environment variable is not set');
    }

    genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.85,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    });
  }

  return model;
}

/**
 * Invokes Gemini with the provided prompt and returns the generated text
 * along with token usage metadata. Callers are responsible for handling
 * errors and validating the response shape. Pass `options.generationConfig`
 * to override sampling parameters or set `responseMimeType: 'application/json'`
 * for strict-JSON callers.
 */
export async function callGemini(
  prompt: string,
  options: CallGeminiOptions = {},
): Promise<GeminiResponse> {
  // Guard: enforce per-minute and per-day Gemini provider quotas before
  // making the external request. Throws a typed 429 AppError when either
  // limit is exceeded so the cost of the quota slot is never wasted.
  await checkGeminiQuota();

  const genModel = getModel();
  const request = options.generationConfig
    ? {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: options.generationConfig,
      }
    : prompt;
  const result = await genModel.generateContent(request);
  const response = result.response;
  const text = response.text();

  return {
    text,
    tokensInput: response.usageMetadata?.promptTokenCount ?? 0,
    tokensOutput: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

/**
 * Test-only hook for injecting a mock generative model. Pass `null` to
 * reset and force the next call to rebuild from environment variables.
 */
export function _setModel(mockModel: GenerativeModel | null): void {
  model = mockModel;
}
