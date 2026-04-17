import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { logger } from '../../utils/logger.js';
import { externalApiError, generationFailed, AppError } from '../../utils/errors.js';
import type {
  GenerateSessionInput,
  ScriptGenerationResult,
  SafetyCheckResult,
} from './ai.types.js';
import type { InductionStyle, DepthLevel } from '../../config/constants.js';

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

/**
 * Returns the Gemini generative model instance.
 */
function getModel(): GenerativeModel {
  if (!model) {
    const apiKey = process.env.GEMINI_API_KEY ?? '';
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    model = genAI.getGenerativeModel({ model: modelName });
  }

  return model;
}

/**
 * Builds the Gemini prompt for hypnosis script generation.
 */
function buildScriptPrompt(input: GenerateSessionInput): string {
  const inductionDescriptions: Record<InductionStyle, string> = {
    progressive:
      'Start with progressive muscle relaxation, guiding the listener to tense and release each muscle group from toes to head.',
    countdown:
      'Use a countdown induction from 10 to 1, with each number taking the listener deeper into relaxation.',
    'body-scan':
      'Guide the listener through a body scan, bringing awareness and relaxation to each part of the body sequentially.',
  };

  const depthDescriptions: Record<DepthLevel, string> = {
    light: 'Keep suggestions gentle and surface-level. Suitable for beginners or short sessions.',
    medium:
      'Use moderate deepening techniques. Balance between relaxation and focused suggestion work.',
    deep: 'Employ deep trance induction with layered deepening. Use vivid imagery and powerful embedded suggestions.',
  };

  return `You are an expert clinical hypnotherapist and scriptwriter. Generate a professional hypnosis script for an audio session.

## Session Parameters
- **User Goal:** ${input.prompt}
- **Category:** ${input.category}
- **Target Duration:** ${input.durationMinutes} minutes (aim for approximately ${input.durationMinutes * 130} words)
- **Induction Style:** ${inductionDescriptions[input.inductionStyle]}
- **Depth Level:** ${depthDescriptions[input.depthLevel]}
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
 * Generates a hypnosis script using Google Gemini.
 * @returns The generated script text, title, and token usage.
 */
export async function generateScript(
  input: GenerateSessionInput,
): Promise<ScriptGenerationResult> {
  const genModel = getModel();
  const prompt = buildScriptPrompt(input);

  const startTime = Date.now();

  try {
    const result = await genModel.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (!text || text.trim().length === 0) {
      throw generationFailed('Gemini returned an empty response');
    }

    const generationMs = Date.now() - startTime;

    // Parse title from first line
    const lines = text.trim().split('\n');
    const title = lines[0].replace(/^#\s*/, '').trim().slice(0, 60);
    const scriptText = lines.slice(1).join('\n').trim();

    // Extract token usage from response metadata
    const usageMetadata = response.usageMetadata;
    const tokensInput = usageMetadata?.promptTokenCount ?? 0;
    const tokensOutput = usageMetadata?.candidatesTokenCount ?? 0;

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
    };
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    logger.error({ err }, 'Gemini script generation failed');
    throw externalApiError('gemini', 'Failed to generate hypnosis script');
  }
}

/**
 * Regenerates a single paragraph of an existing script using Gemini.
 */
export async function regenerateParagraph(
  currentParagraph: string,
  previousParagraph: string | null,
  nextParagraph: string | null,
): Promise<string> {
  const genModel = getModel();

  const contextParts: string[] = [];
  if (previousParagraph) {
    contextParts.push(`Previous paragraph for context: "${previousParagraph}"`);
  }
  contextParts.push(`Paragraph to rewrite: "${currentParagraph}"`);
  if (nextParagraph) {
    contextParts.push(`Next paragraph for context: "${nextParagraph}"`);
  }

  const prompt = `You are writing a hypnosis script. Rewrite the following paragraph to be more effective, calming, and hypnotic. Keep the same general theme and flow but improve the language, imagery, and suggestions.

${contextParts.join('\n\n')}

Respond with ONLY the rewritten paragraph, no explanations or additional text.`;

  try {
    const result = await genModel.generateContent(prompt);
    const text = result.response.text().trim();

    if (!text) {
      throw generationFailed('Gemini returned an empty regeneration');
    }

    return text;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    logger.error({ err }, 'Gemini paragraph regeneration failed');
    throw externalApiError('gemini', 'Failed to regenerate paragraph');
  }
}

/**
 * Checks generated script content for safety using Gemini.
 * Filters out medical claims, harmful content, etc.
 */
export async function checkScriptSafety(
  scriptText: string,
): Promise<SafetyCheckResult> {
  const genModel = getModel();

  const prompt = `You are a safety reviewer for hypnosis scripts. Review the following script and determine if it's safe for consumer use.

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

  try {
    const result = await genModel.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse JSON from response, handling potential markdown code blocks
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr) as { safe: boolean; reason?: string };

    return {
      isSafe: parsed.safe,
      reason: parsed.reason,
    };
  } catch (err) {
    logger.error({ err }, 'Script safety check failed — defaulting to safe');
    // If safety check itself fails, log and allow (don't block generation)
    return { isSafe: true };
  }
}

/**
 * Allows injecting a mock model for testing.
 */
export function _setModel(mockModel: GenerativeModel | null): void {
  model = mockModel;
}
