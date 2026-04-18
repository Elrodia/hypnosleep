import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';

/**
 * Raw response returned by {@link callGemini}, exposing the generated text
 * along with token usage metadata for audit logging.
 */
export interface GeminiResponse {
  text: string;
  tokensInput: number;
  tokensOutput: number;
}

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

/**
 * Returns the singleton Gemini generative model instance, lazily
 * constructing it from `GEMINI_API_KEY` / `GEMINI_MODEL` the first time
 * it is needed. Configured for JSON-only output with a creative-but-stable
 * sampling profile tuned for hypnosis script generation.
 */
export function getModel(): GenerativeModel {
  if (!model) {
    const apiKey = process.env.GEMINI_API_KEY ?? '';
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
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
 * errors and validating the response shape.
 */
export async function callGemini(prompt: string): Promise<GeminiResponse> {
  const genModel = getModel();
  const result = await genModel.generateContent(prompt);
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
