import { callGemini } from './ai.gemini.js';
import { buildSafetyCheckPrompt } from './ai.prompts.js';
import { logger } from '../../utils/logger.js';
import type { SafetyCheckResult } from './ai.types.js';

/**
 * Re-export the shared safety result shape under a more local name. Both
 * the quick and deep checks emit `{ safe, flags[] }` so callers can treat
 * them uniformly.
 */
export type QuickSafetyResult = SafetyCheckResult;

/**
 * Discriminatory slur list. Kept as a separate constant that is **never**
 * logged or echoed to the client to avoid us repeating the harm we are
 * trying to filter. The list is intentionally short — the deep safety
 * pass is responsible for catching coded variants.
 */
const SLUR_TERMS: readonly string[] = [
  // Common racial / ethnic slurs (lower-cased, word-boundary matched).
  // This list is deliberately conservative; the LLM-backed deep pass
  // covers coded variants and context-dependent slurs.
  'nigger',
  'nigga',
  'chink',
  'spic',
  'kike',
  'faggot',
  'tranny',
  'retard',
  'retarded',
];

/**
 * Medical-claim trigger phrases. We require slightly more context than a
 * bare "cure" so that benign phrasing ("you are the cure for your own
 * stress") doesn't false-positive.
 */
const MEDICAL_KEYWORDS: readonly string[] = [
  'cure your',
  'cures your',
  'will cure',
  'cure for',
  'treats your',
  'treat your',
  'treatment for',
  'diagnose',
  'diagnosis',
  'diagnoses',
  'heal your',
  'heals your',
  'medication',
  'prescription',
  'antidepressant',
  'antipsychotic',
  'replace your doctor',
  'stop taking your medication',
  'stop your medication',
];

/** Explicit drug-name list. */
const DRUG_KEYWORDS: readonly string[] = [
  'xanax',
  'ambien',
  'prozac',
  'zoloft',
  'lexapro',
  'valium',
  'klonopin',
  'adderall',
  'ritalin',
  'oxycodone',
  'oxycontin',
  'fentanyl',
  'percocet',
  'vicodin',
  'ssri',
  'benzodiazepine',
];

/** Self-harm / suicide trigger phrases. */
const SELF_HARM_KEYWORDS: readonly string[] = [
  'suicide',
  'self-harm',
  'self harm',
  'kill yourself',
  'kill themselves',
  'end your life',
  'ending your life',
  'hurt yourself',
];

/** Sexual / romantic content terms. */
const SEXUAL_KEYWORDS: readonly string[] = [
  'sexual',
  'sex with',
  'have sex',
  'erotic',
  'aroused',
  'arousal',
  'orgasm',
  'masturbat',
  'genital',
  'penis',
  'vagina',
  'breast',
  'nipple',
];

/**
 * Keyword-based heuristic safety check. Cheap (<2ms, no network), so we
 * always run it before paying for a deep LLM review. Returns the new
 * `{ safe, flags[] }` shape with one flag per matched category.
 *
 * Flags emitted:
 *   - `medical_claim`
 *   - `drug_reference`
 *   - `suicide_self_harm`
 *   - `sexual`
 *   - `discriminatory`  (slurs; matched terms are never logged)
 */
export function quickSafetyCheck(script: string): QuickSafetyResult {
  const flags: string[] = [];
  const lower = script.toLowerCase();

  if (MEDICAL_KEYWORDS.some((k) => lower.includes(k))) flags.push('medical_claim');
  if (DRUG_KEYWORDS.some((k) => wordBoundaryMatch(lower, k))) flags.push('drug_reference');
  if (SELF_HARM_KEYWORDS.some((k) => lower.includes(k))) flags.push('suicide_self_harm');
  if (SEXUAL_KEYWORDS.some((k) => lower.includes(k))) flags.push('sexual');
  if (SLUR_TERMS.some((k) => wordBoundaryMatch(lower, k))) flags.push('discriminatory');

  return { safe: flags.length === 0, flags };
}

/**
 * LLM-backed safety check used for sensitive categories where the quick
 * heuristic is not sufficient. Returns the controlled-vocabulary
 * `{ safe, flags[] }` shape from `buildSafetyCheckPrompt`.
 *
 * **Fail-closed:** if the response cannot be parsed (or the model call
 * itself throws), the function returns `{ safe: false, flags: ['parse_error'] }`
 * so callers reject the script rather than letting unreviewable output
 * through.
 */
export async function deepSafetyCheck(script: string): Promise<SafetyCheckResult> {
  let raw: string;
  try {
    const { text } = await callGemini(buildSafetyCheckPrompt(script), {
      generationConfig: { responseMimeType: 'application/json' },
    });
    raw = text;
  } catch (err) {
    logger.error({ err }, 'Deep safety check call failed — failing closed');
    return { safe: false, flags: ['parse_error'] };
  }

  try {
    const jsonStr = raw
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(jsonStr) as { safe?: unknown; flags?: unknown };

    const safe = parsed.safe === true;
    const flags = Array.isArray(parsed.flags)
      ? parsed.flags.filter((f): f is string => typeof f === 'string')
      : [];

    if (typeof parsed.safe !== 'boolean') {
      // Missing/invalid `safe` field — treat as parse failure.
      return { safe: false, flags: ['parse_error'] };
    }
    return { safe, flags };
  } catch (err) {
    logger.error({ err }, 'Deep safety check parse failed — failing closed');
    return { safe: false, flags: ['parse_error'] };
  }
}

/**
 * Checks `term` (already lower-cased) appears in `lower` at a word
 * boundary. We use this for the slur and drug lists to avoid matching
 * substrings of unrelated words.
 */
function wordBoundaryMatch(lower: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(lower);
}
