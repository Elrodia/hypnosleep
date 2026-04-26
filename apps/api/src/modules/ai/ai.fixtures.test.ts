/**
 * Live-AI fixtures for the script generator.
 *
 * Five hand-crafted user prompts spanning the major session categories.
 * Each test runs the real `generateScript` path against Gemini, so:
 *
 *   - This file is **gated behind `RUN_LIVE_AI=1`** (use the
 *     `npm run test:live-ai` script). Without that flag every fixture is
 *     skipped via `describe.skipIf` so unit-test runs never burn quota.
 *   - Unit-test files in `tests/modules/ai/` mock `callGemini` and stay
 *     the source of truth for behavioural assertions.
 *
 * Each fixture asserts the contract from the spec:
 *
 *   - `scriptText.length > 800` (or `> 1500` for ≥12-minute sessions)
 *   - `title.length ≤ 50`
 *   - script body contains the user's core topic words
 *   - script body contains at least one `<break time="…"/>` SSML tag
 *   - script body contains no forbidden tokens
 *     (cure, treatment, diagnose, medication, prescription)
 *   - `estimatedSeconds` is within ±25% of `durationMin × 60`
 */
import { describe, expect, it } from 'vitest';
import { generateScript } from './ai.service.js';
import type { GenerateSessionInput } from './ai.types.js';

const RUN_LIVE_AI = process.env.RUN_LIVE_AI === '1';

interface Fixture {
  name: string;
  input: GenerateSessionInput;
  /** Words/topics the generated body MUST contain (case-insensitive). */
  topicWords: string[];
}

const fixtures: Fixture[] = [
  {
    name: 'Sleep — racing thoughts',
    input: {
      userId: 'fixture-user',
      prompt: "I have racing thoughts at night and can't fall asleep before 2am.",
      category: 'sleep',
      voiceId: 'en-US-AnaNeural',
      backgroundSound: 'rain',
      durationMinutes: 10,
      inductionStyle: 'body-scan',
      depthLevel: 'deep',
      wakeUpEnding: false,
    },
    topicWords: ['sleep'],
  },
  {
    name: 'Confidence — job interview impostor',
    input: {
      userId: 'fixture-user',
      prompt: 'I have a job interview tomorrow and feel like an impostor.',
      category: 'confidence',
      voiceId: 'en-US-GuyNeural',
      backgroundSound: 'silence',
      durationMinutes: 8,
      inductionStyle: 'countdown',
      depthLevel: 'medium',
      wakeUpEnding: true,
    },
    topicWords: ['interview'],
  },
  {
    name: 'Habits — stop doomscrolling before bed',
    input: {
      userId: 'fixture-user',
      prompt: 'Help me stop scrolling social media before bed.',
      category: 'habits',
      voiceId: 'en-GB-SoniaNeural',
      backgroundSound: 'silence',
      durationMinutes: 15,
      inductionStyle: 'progressive',
      depthLevel: 'medium',
      wakeUpEnding: true,
    },
    topicWords: ['scrolling'],
  },
  {
    name: 'Anxiety — fear of flying',
    input: {
      userId: 'fixture-user',
      prompt: 'I have a fear of flying and travel next week.',
      category: 'anxiety',
      voiceId: 'en-AU-NatashaNeural',
      backgroundSound: 'wind',
      durationMinutes: 12,
      inductionStyle: 'body-scan',
      depthLevel: 'medium',
      wakeUpEnding: false,
    },
    topicWords: ['flying'],
  },
  {
    name: 'Focus — 3-hour study block',
    input: {
      userId: 'fixture-user',
      prompt: 'I need deep focus for a 3-hour study block.',
      category: 'focus',
      voiceId: 'en-US-DavisNeural',
      backgroundSound: 'white_noise',
      durationMinutes: 6,
      inductionStyle: 'countdown',
      depthLevel: 'light',
      wakeUpEnding: true,
    },
    topicWords: ['focus', 'study'],
  },
];

const FORBIDDEN_TOKENS = [
  'cure',
  'treatment',
  'diagnose',
  'medication',
  'prescription',
];

describe.skipIf(!RUN_LIVE_AI)('AI fixtures (live Gemini)', () => {
  for (const fixture of fixtures) {
    it(
      fixture.name,
      async () => {
        const result = await generateScript(fixture.input);

        // Title length cap from the spec.
        expect(result.title.length).toBeLessThanOrEqual(50);

        // Script length thresholds: 800 chars baseline, 1500 for "long"
        // sessions (≥ 12 minutes).
        const minLength = fixture.input.durationMinutes >= 12 ? 1500 : 800;
        expect(result.scriptText.length).toBeGreaterThan(minLength);

        const lowerBody = result.scriptText.toLowerCase();

        // Topic words from the user prompt must surface in the script.
        for (const word of fixture.topicWords) {
          expect(lowerBody).toContain(word.toLowerCase());
        }

        // At least one SSML <break time="…"/> tag must be present.
        expect(result.scriptText).toMatch(/<break time="/);

        // No forbidden tokens (medical-claim words) anywhere in the body.
        for (const token of FORBIDDEN_TOKENS) {
          expect(lowerBody).not.toContain(token);
        }

        // estimatedSeconds within ±25% of durationMin × 60.
        const targetSec = fixture.input.durationMinutes * 60;
        expect(result.estimatedSeconds).toBeGreaterThanOrEqual(targetSec * 0.75);
        expect(result.estimatedSeconds).toBeLessThanOrEqual(targetSec * 1.25);
      },
      // Generous per-test timeout: Gemini script generation typically
      // takes 10–30 s, plus retry budget on transient errors.
      120_000,
    );
  }
});
