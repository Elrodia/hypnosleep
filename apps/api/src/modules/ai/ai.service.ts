import type { GenerativeModel } from '@google/generative-ai';
import { randomUUID } from 'node:crypto';
import { callGemini, _setModel as _setGeminiModel } from './ai.gemini.js';
import {
  buildScriptPrompt,
  buildRegenerateParagraphPrompt,
} from './ai.prompts.js';
import { deepSafetyCheck, quickSafetyCheck } from './ai.safety.js';
import { logger } from '../../utils/logger.js';
import {
  externalApiError,
  generationFailed,
  AppError,
} from '../../utils/errors.js';
import type {
  GenerateSessionInput,
  ScriptGenerationResult,
  SafetyCheckResult,
} from './ai.types.js';

const MAX_RETRIES = 2;

/**
 * Sensitive categories that warrant a second, LLM-based safety pass
 * after the quick heuristic check.
 */
const SENSITIVE_CATEGORIES = new Set(['fears', 'habits']);

/**
 * Best-effort audit log insert into the `ai_generations` Postgres table.
 * Dynamically imports the DB client and schema so this module can still
 * be imported in environments (tests, tooling) where env validation has
 * not been performed.
 */
async function logGeneration(row: {
  userId: string;
  sessionId: string;
  promptText: string;
  voice: string;
  tokensInput?: number;
  tokensOutput?: number;
  generationMs: number;
  status: 'success' | 'failed';
  errorMessage?: string | null;
}): Promise<void> {
  try {
    const [{ pgDb }, { aiGenerations }] = await Promise.all([
      import('../../db/postgres/client.js'),
      import('../../db/postgres/schema/ai-generations.js'),
    ]);
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    await pgDb.insert(aiGenerations).values({
      userId: row.userId,
      sessionId: row.sessionId,
      promptText: row.promptText,
      model,
      tokensInput: row.tokensInput,
      tokensOutput: row.tokensOutput,
      generationMs: row.generationMs,
      voice: row.voice,
      status: row.status,
      errorMessage: row.errorMessage ?? null,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to log AI generation');
  }
}

/**
 * Generates a hypnosis script via Gemini, with retry/backoff, token-usage
 * tracking, and a best-effort audit log write to `ai_generations`.
 *
 * Transient Gemini failures are retried up to {@link MAX_RETRIES} times
 * with linear backoff. Permanent failures (e.g. empty response, safety
 * violations) are surfaced to the caller as typed {@link AppError}s.
 */
export async function generateScript(
  input: GenerateSessionInput,
): Promise<ScriptGenerationResult> {
  const startTime = Date.now();
  const prompt = buildScriptPrompt(input);
  // Audit-log correlation id: prefer the caller-supplied sessionId (which
  // will match the `sessions` row), otherwise synthesize a random UUID so
  // the `session_id` NOT NULL column in `ai_generations` is always valid.
  const auditSessionId = input.sessionId ?? randomUUID();

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { text, tokensInput, tokensOutput } = await callGemini(prompt);

      if (!text || text.trim().length === 0) {
        throw generationFailed('Gemini returned an empty response');
      }

      // Parse: first non-empty line is title, rest is body.
      const lines = text.trim().split('\n');
      const title = lines[0].replace(/^#\s*/, '').trim().slice(0, 60);
      const scriptText = lines.slice(1).join('\n').trim();

      const generationMs = Date.now() - startTime;

      // Cheap heuristic safety pass — always runs.
      const quick = quickSafetyCheck(scriptText);
      let safetyFailure: string | null = null;
      if (!quick.safe) {
        safetyFailure = `safety_flags: ${quick.flags.join(',')}`;
      } else if (SENSITIVE_CATEGORIES.has(input.category)) {
        // Deep safety pass only for sensitive categories, to keep cost down.
        const deep = await deepSafetyCheck(scriptText);
        if (!deep.isSafe) {
          safetyFailure = `safety_unsafe: ${deep.reason ?? 'flagged'}`;
        }
      }

      // Fire-and-forget audit log (never blocks the response).
      void logGeneration({
        userId: input.userId,
        sessionId: auditSessionId,
        promptText: input.prompt,
        voice: input.voiceId,
        tokensInput,
        tokensOutput,
        generationMs,
        status: safetyFailure ? 'failed' : 'success',
        errorMessage: safetyFailure,
      });

      if (safetyFailure) {
        throw generationFailed(
          'Generated content failed safety review. Please rephrase your request.',
          { safetyFailure },
        );
      }

      logger.info(
        {
          title,
          tokensInput,
          tokensOutput,
          generationMs,
          scriptLength: scriptText.length,
        },
        'Script generated successfully',
      );

      return { scriptText, title, tokensInput, tokensOutput, generationMs };
    } catch (err) {
      lastError = err;

      // Do not retry permanent failures — just surface them.
      if (err instanceof AppError) {
        logger.error({ err }, 'Script generation failed (permanent)');
        void logGeneration({
          userId: input.userId,
          sessionId: auditSessionId,
          promptText: input.prompt,
          voice: input.voiceId,
          generationMs: Date.now() - startTime,
          status: 'failed',
          errorMessage: err.message,
        });
        throw err;
      }

      // Transient error: retry with linear backoff (1s, 2s).
      if (attempt < MAX_RETRIES) {
        const delayMs = 1000 * (attempt + 1);
        logger.warn(
          { attempt: attempt + 1, delayMs, err },
          'Gemini call failed, retrying',
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
    }
  }

  logger.error({ err: lastError }, 'Gemini script generation failed');
  void logGeneration({
    userId: input.userId,
    sessionId: auditSessionId,
    promptText: input.prompt,
    voice: input.voiceId,
    generationMs: Date.now() - startTime,
    status: 'failed',
    errorMessage:
      lastError instanceof Error ? lastError.message : 'unknown error',
  });
  throw externalApiError('gemini', 'Failed to generate hypnosis script');
}

/**
 * Regenerates a single paragraph of an existing script. Uses the same
 * Gemini model but without the retry pipeline — regeneration is
 * interactive and the user can trivially retry from the UI.
 */
export async function regenerateParagraph(
  currentParagraph: string,
  previousParagraph: string | null,
  nextParagraph: string | null,
): Promise<string> {
  const prompt = buildRegenerateParagraphPrompt(
    currentParagraph,
    previousParagraph,
    nextParagraph,
  );

  try {
    const { text } = await callGemini(prompt);
    const trimmed = text.trim();
    if (!trimmed) {
      throw generationFailed('Gemini returned an empty regeneration');
    }
    return trimmed;
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ err }, 'Gemini paragraph regeneration failed');
    throw externalApiError('gemini', 'Failed to regenerate paragraph');
  }
}

/**
 * LLM-based safety review of an already-generated script. Kept as the
 * single public safety entry point for the controller; internally it
 * delegates to {@link deepSafetyCheck}.
 */
export async function checkScriptSafety(
  scriptText: string,
): Promise<SafetyCheckResult> {
  return deepSafetyCheck(scriptText);
}

/**
 * Test-only hook for injecting a mock generative model. Delegates to
 * {@link _setGeminiModel} in `ai.gemini.ts`.
 */
export function _setModel(mockModel: GenerativeModel | null): void {
  _setGeminiModel(mockModel);
}
