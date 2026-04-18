import type { InductionStyle, DepthLevel } from '../../config/constants.js';
import type { GenerateSessionInput } from './ai.types.js';

/**
 * Voice-id → tone-hint map used to steer Gemini's pacing and warmth so the
 * generated script matches the eventual TTS voice. Keys mirror the
 * `VoiceId`s defined in `config/constants.ts`.
 */
export const VOICE_TONE_HINTS: Record<string, string> = {
  'en-US-AnaNeural':     'soft, maternal, slow-paced, lots of pauses',
  'en-US-GuyNeural':     'steady, grounded, deliberate, masculine reassurance',
  'en-GB-SoniaNeural':   'refined, articulate, elegant rhythm',
  'en-AU-NatashaNeural': 'warm, gentle, melodic',
  'en-US-AriaNeural':    'bright, clear, friendly',
  'en-US-DavisNeural':   'low, focused, professional',
};

const INDUCTION_DESCRIPTIONS: Record<InductionStyle, string> = {
  progressive:
    'Start with progressive muscle relaxation, guiding the listener to tense and release each muscle group from toes to head.',
  countdown:
    'Use a countdown induction from 10 to 1, with each number taking the listener deeper into relaxation.',
  'body-scan':
    'Guide the listener through a body scan, bringing awareness and relaxation to each part of the body sequentially.',
};

const DEPTH_DESCRIPTIONS: Record<DepthLevel, string> = {
  light: 'Keep suggestions gentle and surface-level. Suitable for beginners or short sessions.',
  medium:
    'Use moderate deepening techniques. Balance between relaxation and focused suggestion work.',
  deep: 'Employ deep trance induction with layered deepening. Use vivid imagery and powerful embedded suggestions.',
};

/**
 * Builds the master prompt for generating a hypnosis script. The prompt is
 * heavily parameterized on induction style, depth, voice tone, duration,
 * and whether the session should wake the listener up at the end.
 *
 * The returned prompt instructs Gemini to emit plain text whose first line
 * is the session title and whose remainder is the script body.
 */
export function buildScriptPrompt(input: GenerateSessionInput): string {
  const voiceTone = VOICE_TONE_HINTS[input.voiceId] ?? 'calm, soothing';

  return `You are an expert clinical hypnotherapist and scriptwriter. Generate a professional hypnosis script for an audio session.

## Session Parameters
- **User Goal:** ${input.prompt}
- **Category:** ${input.category}
- **Target Duration:** ${input.durationMinutes} minutes (aim for approximately ${input.durationMinutes * 130} words)
- **Induction Style:** ${INDUCTION_DESCRIPTIONS[input.inductionStyle]}
- **Depth Level:** ${DEPTH_DESCRIPTIONS[input.depthLevel]}
- **Voice Tone:** ${voiceTone}
- **Wake-up Ending:** ${input.wakeUpEnding ? 'Include a gentle count-up awakening sequence at the end' : 'End with suggestions for natural, restful sleep'}

## Script Requirements
1. Write in second person ("you"), speaking directly to the listener
2. Use present tense and positive language only (no negations like "don't worry")
3. Include natural pauses indicated by "..." for the TTS voice
4. Structure the script with clear paragraphs separated by blank lines
5. Include at least 3 embedded suggestions related to the user's goal
6. Use sensory-rich language (visual, auditory, kinesthetic)
7. Avoid any medical claims, diagnoses, or promises of curing conditions
8. Do NOT include any stage directions, speaker labels, or formatting — output ONLY the spoken script text
9. Do NOT mention hypnosis, hypnotherapy, or trance explicitly in the script

## Output Format
Return the script as plain text with paragraphs separated by blank lines.
The FIRST line must be a short, compelling title for the session (max 60 chars), followed by a blank line, then the script body.

## Safety
- Never suggest the listener can cure diseases
- Never suggest the listener should stop prescribed medication
- Never include content that could cause distress or panic
- Always maintain a calming, supportive, and empowering tone`;
}

/**
 * Builds the prompt for the LLM-based "deep" safety check. The model is
 * asked to emit a single JSON object of the shape
 * `{ "safe": boolean, "reason"?: string }`.
 */
export function buildSafetyCheckPrompt(scriptText: string): string {
  return `You are a safety reviewer for hypnosis scripts. Review the following script and determine if it's safe for consumer use.

Flag the script as UNSAFE if it contains ANY of the following:
1. Claims to cure, treat, or diagnose medical conditions
2. Suggestions to stop taking prescribed medication
3. Content that could cause panic, distress, or psychological harm
4. Sexually explicit or inappropriate content
5. Content encouraging self-harm or harm to others
6. Instructions to perform dangerous physical actions while in a relaxed state

Script to review:
"""
${scriptText}
"""

Respond in JSON format only:
{ "safe": true } or { "safe": false, "reason": "brief explanation" }`;
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
