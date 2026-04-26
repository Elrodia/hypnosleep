import type { InductionStyle, DepthLevel, VoiceId } from '../../config/constants.js';
import type { GenerateSessionInput } from './ai.types.js';

/**
 * Voice-id → tone-hint map used to steer Gemini's pacing and warmth so the
 * generated script matches the eventual TTS voice. Keys mirror the
 * `VoiceId`s defined in `config/constants.ts`; typing as a
 * `Partial<Record<VoiceId, string>>` ensures typos and removed voices are
 * caught at compile time while still allowing partial coverage.
 *
 * The labels below match the spec from the master prompt template:
 *   Ana=soft maternal, Guy=grounded masculine, Sonia=refined British,
 *   Natasha=warm Australian, Aria=bright friendly, Ryan=low focused.
 * Note: the Edge TTS voice id we currently use for "Ryan" is
 * `en-US-DavisNeural` (see `config/constants.ts`).
 */
export const VOICE_TONE_HINTS: Partial<Record<VoiceId, string>> = {
  'en-US-AnaNeural':     'soft, maternal, slow-paced, with frequent pauses',
  'en-US-GuyNeural':     'grounded, masculine, deliberate reassurance',
  'en-GB-SoniaNeural':   'refined British, articulate, elegant rhythm',
  'en-AU-NatashaNeural': 'warm Australian, gentle, melodic',
  'en-US-AriaNeural':    'bright, friendly, clear and inviting',
  'en-US-DavisNeural':   'low, focused, professional (Ryan)',
};

const INDUCTION_DESCRIPTIONS: Record<InductionStyle, string> = {
  progressive:
    'Use progressive muscle relaxation. Welcome the listener, draw attention to the breath and body, then guide them to release tension from feet to head.',
  countdown:
    'Use a countdown induction. Welcome the listener, settle the breath, then count down (e.g. 10 → 1) so each number deepens relaxation.',
  'body-scan':
    'Use a body-scan induction. Welcome the listener, anchor in the breath, then sweep awareness slowly through each part of the body.',
};

const DEPTH_DESCRIPTIONS: Record<DepthLevel, string> = {
  light:
    'Light depth: gentle deepening with surface imagery (a soft descending staircase of 5 steps, drifting downward through a warm cloud).',
  medium:
    'Medium depth: layered descending counting and imagery, doubling relaxation with each step.',
  deep:
    'Deep depth: vivid, multi-sensory descending imagery (long staircases, deepening lifts, cascading numbers) with embedded confusion and fractionation.',
};

/**
 * Builds the master prompt for generating a hypnosis script. The prompt
 * is heavily parameterized on induction style, depth, voice tone,
 * duration, and whether the session should wake the listener up at the
 * end. The output is a strict JSON envelope:
 *
 *   { "title": string ≤ 50 chars, "scriptText": string, "estimatedSeconds": number }
 *
 * No markdown, no preamble — `responseMimeType: 'application/json'` is
 * also set on the Gemini call to enforce this server-side.
 */
export function buildScriptPrompt(input: GenerateSessionInput): string {
  const voiceTone = VOICE_TONE_HINTS[input.voiceId] ?? 'calm, soothing';
  const wordTarget = input.durationMinutes * 150;
  const estimatedSeconds = input.durationMinutes * 60;

  const closing = input.wakeUpEnding
    ? 'Closing (5%): a gentle count-up from 1 to 5 with rising energy, ending fully alert, refreshed, and present.'
    : 'Closing (5%): a slow fade-out into restful sleep — soft, descending phrases that allow the listener to drift off naturally.';

  return `You are an expert clinical hypnotherapist and scriptwriter. Generate a professional, therapeutic hypnosis script for an audio session.

## Session Parameters
- User goal (address verbatim): ${input.prompt}
- Category: ${input.category}
- Target duration: ${input.durationMinutes} minutes (~${wordTarget} words; estimatedSeconds ≈ ${estimatedSeconds})
- Induction style: ${INDUCTION_DESCRIPTIONS[input.inductionStyle]}
- Depth level: ${DEPTH_DESCRIPTIONS[input.depthLevel]}
- Voice tone hint (${input.voiceId}): ${voiceTone}
- Wake-up ending: ${input.wakeUpEnding ? 'YES — count up 1 → 5 with rising energy at the end.' : 'NO — fade gently into sleep at the end.'}

## Required Five-Section Structure
Produce the script in this exact order, hitting the target word percentages of total length:
1. Induction (≈20%) — welcome, breath and body awareness, then the chosen induction style.
2. Deepening (≈15%) — descending counting and/or imagery; intensity matches the depth level.
3. Suggestion (≈50%) — the therapeutic core. Address the user goal verbatim. Deliver every key idea in three modes:
     (a) direct affirmation ("you are…"),
     (b) vivid metaphor (sensory imagery),
     (c) future pacing ("imagine yourself next week…").
   Repeat the key suggestion phrases 3–5 times with variation.
4. Integration (≈10%) — anchor the new state to a physical trigger the listener can use later (e.g. a slow deep breath, touching thumb to finger).
5. ${closing}

## Voice & Style Rules
- Always speak in second person ("you").
- Always present tense.
- Use permissive language ("you may notice…", "perhaps you find…", "you might begin to…").
- Use sensory-rich language (visual, auditory, kinesthetic).
- Insert SSML breaks: <break time="2s"/> after key sentences, <break time="3s"/> between sections.
- Do NOT mention the words "hypnosis", "hypnotic", "trance" inside the script body.
- Do NOT include speaker labels, stage directions, or markdown.

## Forbidden Content (reject internally and rewrite if needed)
- Medical claims, diagnoses, drug names, prescription advice.
- Sexual or romantic content.
- Any content directed at minors.
- Instructions that could cause physical harm.
- Self-harm, suicide, or harm-to-others content.
- Discriminatory or slur language.

## Output Format — STRICT JSON ONLY
Return ONE JSON object and nothing else. No markdown, no commentary, no preamble.
Schema:
{
  "title": string (≤ 50 characters, evocative, no quotes),
  "scriptText": string (the full script body, ~${wordTarget} words, including SSML <break time="…"/> tags),
  "estimatedSeconds": number (whole-second estimate of spoken duration; aim near ${estimatedSeconds})
}`;
}

/**
 * Builds the prompt for the LLM-based "deep" safety check. The model is
 * asked to emit a single strict-JSON object of the shape
 * `{ "safe": boolean, "flags": string[] }` where `flags` is drawn from
 * the controlled vocabulary listed below.
 */
export function buildSafetyCheckPrompt(scriptText: string): string {
  return `You are a safety reviewer for hypnosis scripts. Review the following script and decide whether it is safe for adult consumer use.

Flag the script as UNSAFE if it contains ANY of the following. Use the listed flag tokens.

Possible flags (use only these values):
- "medical_claim"          — claims to cure, treat, diagnose, or replace medical advice / prescribed medication.
- "drug_reference"         — explicit drug names (xanax, ambien, prozac, antidepressants, antipsychotics, etc.).
- "harmful_to_vulnerable"  — content likely to harm someone with anxiety, phobias, addiction, or other vulnerabilities (e.g. amplifying a phobia, encouraging relapse).
- "sexual"                 — sexual or romantic content.
- "discriminatory"         — slurs or discriminatory language.
- "physical_harm"          — instructions that could cause physical injury (driving while in trance, unsafe physical actions).
- "suicide_self_harm"      — references to suicide, self-harm, ending one's life, harming others.

Script to review:
"""
${scriptText}
"""

Output STRICT JSON only — no markdown, no commentary, no preamble:
{ "safe": boolean, "flags": string[] }

If the script is safe, return { "safe": true, "flags": [] }.
Otherwise list every applicable flag from the controlled vocabulary above.`;
}

/**
 * Builds the prompt for regenerating a single paragraph of an existing
 * hypnosis script, optionally using neighbouring paragraphs as context
 * so the rewrite preserves narrative flow.
 */
export function buildRegenerateParagraphPrompt(
  currentParagraph: string,
  previousParagraph: string | null,
  nextParagraph: string | null,
): string {
  const contextParts: string[] = [];
  if (previousParagraph) {
    contextParts.push(`Previous paragraph for context: "${previousParagraph}"`);
  }
  contextParts.push(`Paragraph to rewrite: "${currentParagraph}"`);
  if (nextParagraph) {
    contextParts.push(`Next paragraph for context: "${nextParagraph}"`);
  }

  return `You are writing a hypnosis script. Rewrite the following paragraph to be more effective, calming, and hypnotic. Keep the same general theme and flow but improve the language, imagery, and suggestions.

${contextParts.join('\n\n')}

Respond with ONLY the rewritten paragraph, no explanations or additional text.`;
}
