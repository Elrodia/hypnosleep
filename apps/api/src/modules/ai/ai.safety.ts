import { callGemini } from './ai.gemini.js';
import { buildSafetyCheckPrompt } from './ai.prompts.js';
import { logger } from '../../utils/logger.js';
import type { SafetyCheckResult } from './ai.types.js';

/**
 * Structured safety result emitted by {@link quickSafetyCheck}. `flags`
 * is a list of short, machine-readable reason codes that can be passed
 * straight to logging / telemetry.
 */
export interface QuickSafetyResult {
  safe: boolean;
  flags: string[];
}

/**
 * Keyword-based heuristic safety check. Cheap to run (no network call),
 * so we always run it before paying for a deep LLM review. Matches on
 * common medical-claim language and explicit self-harm phrases.
 */
export function quickSafetyCheck(script: string): QuickSafetyResult {
  const flags: string[] = [];
  const lower = script.toLowerCase();

  const medicalKeywords = [
    'cure your',
    'cures your',
    'will cure',
    'treats your',
    'diagnose',
    'diagnosis',
    'prescription',
    'antidepressant',
    'stop taking your medication',
    'stop your medication',
  ];
  if (medicalKeywords.some((k) => lower.includes(k))) flags.push('medical_claim');

  const harmKeywords = [
    'suicide',
    'self-harm',
    'kill yourself',
    'end your life',
    'ending your life',
    'hurt yourself',
  ];
  if (harmKeywords.some((k) => lower.includes(k))) flags.push('suicide_self_harm');

  return { safe: flags.length === 0, flags };
}

/**
 * LLM-backed safety check used for sensitive categories where the quick
 * heuristic is not sufficient. If the model response cannot be parsed
 * the check errs on the side of "safe" but logs the failure — matching
 * the historical behaviour of {@link checkScriptSafety} in `ai.service.ts`.
 */
export async function deepSafetyCheck(script: string): Promise<SafetyCheckResult> {
  try {
    const { text } = await callGemini(buildSafetyCheckPrompt(script));
    const jsonStr = text
      .trim()
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    const parsed = JSON.parse(jsonStr) as { safe: boolean; reason?: string };
    return { isSafe: parsed.safe, reason: parsed.reason };
  } catch (err) {
    logger.error({ err }, 'Deep safety check failed — defaulting to safe');
    return { isSafe: true };
  }
}
