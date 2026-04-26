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
  quotaExhausted,
  AppError,
} from '../../utils/errors.js';
import type {
  GenerateSessionInput,
  ScriptGenerationResult,
  SafetyCheckResult,
} from './ai.types.js';

const MAX_RETRIES = 2;

/**
 * Detects a Gemini 429 that represents an *exhausted* quota (i.e. one
 * with a per-day or free-tier window) where retrying within the same
 * window cannot succeed. Returns parsed quota metadata when matched,
 * or `null` for transient/per-minute 429s which should still be
 * retried by the surrounding loop.
 *
 * Shape of the upstream error is documented at
 * https://ai.google.dev/gemini-api/docs/rate-limits and includes a
 * `QuotaFailure` detail with `quotaId` (e.g.
 * `GenerateRequestsPerDayPerProjectPerModel-FreeTier`) and a
 * `RetryInfo` detail with a `retryDelay` like `"24s"`.
 */
function parseExhaustedQuota(err: unknown): {
  quotaId?: string;
  quotaMetric?: string;
  retryDelayMs?: number;
} | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as {
    status?: number;
    errorDetails?: Array<{
      '@type'?: string;
      violations?: Array<{ quotaId?: string; quotaMetric?: string }>;
      retryDelay?: string;
    }>;
  };
  if (e.status !== 429 || !Array.isArray(e.errorDetails)) return null;

  let quotaId: string | undefined;
  let quotaMetric: string | undefined;
  let retryDelayMs: number | undefined;

  for (const detail of e.errorDetails) {
    if (detail['@type']?.endsWith('QuotaFailure')) {
      const violation = detail.violations?.[0];
      quotaId = violation?.quotaId;
      quotaMetric = violation?.quotaMetric;
    } else if (detail['@type']?.endsWith('RetryInfo') && detail.retryDelay) {
      // Format is `<seconds>s` or `<seconds>.<frac>s`.
      const match = /^([0-9]+(?:\.[0-9]+)?)s$/.exec(detail.retryDelay);
      if (match) retryDelayMs = Math.round(Number(match[1]) * 1000);
    }
  }

  // Treat per-day or free-tier-request quotas as exhausted. Other 429s
  // (per-minute throttles) remain transient and should keep retrying.
  const exhausted =
    (quotaId && /PerDay/i.test(quotaId)) ||
    (quotaMetric && /free_tier_requests/i.test(quotaMetric));
  if (!exhausted) return null;

  return { quotaId, quotaMetric, retryDelayMs };
}

/**
 * Sensitive categories that warrant a second, LLM-based safety pass
 * after the quick heuristic check. Keep in sync with the spec in
 * `ai.prompts.ts`: anxiety / fears / habits all involve emotionally
 * loaded content where heuristics alone are not sufficient.
 */
const SENSITIVE_CATEGORIES = new Set(['anxiety', 'fears', 'habits']);

/**
 * Parses Gemini's strict-JSON envelope. We strip stray markdown code
 * fences defensively because some Gemini snapshots still emit them
 * even when `responseMimeType: 'application/json'` is set.
 *
 * Throws an `AppError('GENERATION_FAILED', …)` if the output cannot be
 * parsed or is missing required fields — caller treats these as
 * permanent (not retried) since retrying produces the same garbage.
 */
function parseScriptEnvelope(rawText: string): {
  title: string;
  scriptText: string;
  estimatedSeconds: number;
} {
  const stripped = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw generationFailed('Gemini returned invalid JSON envelope');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw generationFailed('Gemini returned a non-object response');
  }
  const obj = parsed as { title?: unknown; scriptText?: unknown; estimatedSeconds?: unknown };
  if (typeof obj.title !== 'string' || typeof obj.scriptText !== 'string') {
    throw generationFailed('Gemini response missing required fields');
  }
  const estimatedSeconds =
    typeof obj.estimatedSeconds === 'number' && Number.isFinite(obj.estimatedSeconds)
      ? Math.max(0, Math.round(obj.estimatedSeconds))
      : 0;
  return {
    title: obj.title.trim(),
    scriptText: obj.scriptText.trim(),
    estimatedSeconds,
  };
}

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
  // Short-circuit when Postgres is not configured (tests/tooling). Audit
  // logging is strictly best-effort, so silently skip rather than attempt
  // to load the env-validated DB client.
  if (!process.env.DATABASE_URL) {
    return;
  }
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
    // Best-effort: log at warn rather than error so missing/unavailable
    // Postgres in dev/test environments does not look like a real failure.
    logger.warn({ err }, 'Failed to log AI generation');
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
  // Tracks whether this request has already written an `ai_generations`
  // row. Some failure paths (notably safety failures) log before throwing
  // an AppError; without this flag, the AppError catch below would write
  // a second audit row for the same request.
  let didLogAudit = false;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { text, tokensInput, tokensOutput } = await callGemini(prompt, {
        generationConfig: { responseMimeType: 'application/json' },
      });

      if (!text || text.trim().length === 0) {
        throw generationFailed('Gemini returned an empty response');
      }

      // Parse: Gemini is configured with `responseMimeType: 'application/json'`,
      // and the master prompt asks for a strict envelope:
      //   { title: string, scriptText: string, estimatedSeconds: number }
      // We still strip stray markdown code fences defensively.
      const parsed = parseScriptEnvelope(text);
      const title = parsed.title.slice(0, 50);
      const scriptText = parsed.scriptText;
      const estimatedSeconds = parsed.estimatedSeconds;
      if (scriptText.length === 0) {
        throw generationFailed('Gemini returned an empty script body');
      }

      const generationMs = Date.now() - startTime;

      // Safety passes review the full generated content (title + body) so
      // unsafe claims in a user-visible title are not missed.
      const contentForSafetyReview = [title, scriptText]
        .filter((part) => part.length > 0)
        .join('\n\n');

      // Cheap heuristic safety pass — always runs.
      const quick = quickSafetyCheck(contentForSafetyReview);
      let safetyFlags: string[] | null = null;
      if (!quick.safe) {
        safetyFlags = quick.flags;
      } else if (SENSITIVE_CATEGORIES.has(input.category)) {
        // Deep safety pass only for sensitive categories, to keep cost down.
        const deep = await deepSafetyCheck(contentForSafetyReview);
        if (!deep.safe) {
          safetyFlags = deep.flags.length > 0 ? deep.flags : ['unsafe'];
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
        status: safetyFlags ? 'failed' : 'success',
        errorMessage: safetyFlags ? `safety_flags:${safetyFlags.join(',')}` : null,
      });
      didLogAudit = true;

      if (safetyFlags) {
        // Spec: throw AppError('GENERATION_FAILED', …, 400, { safetyFlags }).
        // The 400 status (vs the default 500 from `generationFailed`) signals
        // to the client that this is a content/input issue they can fix by
        // rephrasing, not a server fault.
        throw new AppError(
          'GENERATION_FAILED',
          'Content failed safety review. Please rephrase.',
          400,
          { safetyFlags, reason: `safety_flags:${safetyFlags.join(',')}` },
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

      return {
        scriptText,
        title,
        tokensInput,
        tokensOutput,
        generationMs,
        estimatedSeconds,
      };
    } catch (err) {
      // Daily / free-tier quota exhaustion: retrying within the same
      // window cannot succeed, so convert to a typed AppError and let
      // the AppError branch below short-circuit the retry loop.
      const exhausted = parseExhaustedQuota(err);
      const normalizedErr: unknown = exhausted
        ? quotaExhausted(
            'gemini',
            'Gemini quota exhausted; retry after the quota window resets or enable billing',
            exhausted,
          )
        : err;
      lastError = normalizedErr;

      // Do not retry permanent failures — just surface them. Some paths
      // (e.g. safety failures) have already written an audit row; avoid
      // writing a duplicate.
      if (normalizedErr instanceof AppError) {
        logger.error({ err: normalizedErr }, 'Script generation failed (permanent)');
        if (!didLogAudit) {
          void logGeneration({
            userId: input.userId,
            sessionId: auditSessionId,
            promptText: input.prompt,
            voice: input.voiceId,
            generationMs: Date.now() - startTime,
            status: 'failed',
            errorMessage: normalizedErr.message,
          });
          didLogAudit = true;
        }
        throw normalizedErr;
      }

      // Known permanent configuration errors arrive as AppErrors (see
      // `getModel` in ai.gemini.ts) and are handled in the branch above —
      // no regex matching on error messages needed here.

      // Transient error: retry with linear backoff (1s, 2s).
      if (attempt < MAX_RETRIES) {
        const delayMs = 1000 * (attempt + 1);
        logger.warn(
          { attempt: attempt + 1, delayMs, err: normalizedErr },
          'Gemini call failed, retrying',
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
    }
  }

  logger.error({ err: lastError }, 'Gemini script generation failed');
  if (!didLogAudit) {
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
  }
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
