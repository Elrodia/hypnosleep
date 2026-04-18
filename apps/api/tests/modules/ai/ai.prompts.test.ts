import { describe, it, expect } from 'vitest';
import {
  buildScriptPrompt,
  buildSafetyCheckPrompt,
  buildRegenerateParagraphPrompt,
  VOICE_TONE_HINTS,
} from '@/modules/ai/ai.prompts';
import type { GenerateSessionInput } from '@/modules/ai/ai.types';

const baseInput: GenerateSessionInput = {
  userId: 'u',
  prompt: 'Help me sleep deeply',
  category: 'sleep',
  voiceId: 'en-US-AnaNeural',
  backgroundSound: 'rain',
  durationMinutes: 10,
  inductionStyle: 'body-scan',
  depthLevel: 'deep',
  wakeUpEnding: false,
};

describe('buildScriptPrompt', () => {
  it('includes the user prompt verbatim', () => {
    const prompt = buildScriptPrompt(baseInput);
    expect(prompt).toContain('Help me sleep deeply');
  });

  it('includes the target word count derived from duration', () => {
    const prompt = buildScriptPrompt({ ...baseInput, durationMinutes: 10 });
    // 10 × 130 = 1300 words
    expect(prompt).toContain('1300 words');
  });

  it('uses a sleep-ending when wakeUpEnding is false', () => {
    const prompt = buildScriptPrompt({ ...baseInput, wakeUpEnding: false });
    expect(prompt.toLowerCase()).toContain('natural, restful sleep');
  });

  it('uses a wake-up ending when wakeUpEnding is true', () => {
    const prompt = buildScriptPrompt({
      ...baseInput,
      wakeUpEnding: true,
      category: 'confidence',
    });
    expect(prompt.toLowerCase()).toContain('count-up awakening');
  });

  it('embeds the voice-specific tone hint', () => {
    const prompt = buildScriptPrompt({ ...baseInput, voiceId: 'en-US-AnaNeural' });
    expect(prompt).toContain(VOICE_TONE_HINTS['en-US-AnaNeural']);
  });

  it('falls back to a default tone for unknown voices', () => {
    const prompt = buildScriptPrompt({
      ...baseInput,
      // @ts-expect-error — exercising unknown-voice fallback
      voiceId: 'zz-XX-UnknownNeural',
    });
    expect(prompt.toLowerCase()).toContain('calm');
  });

  it('selects the correct induction description per style', () => {
    const progressive = buildScriptPrompt({
      ...baseInput,
      inductionStyle: 'progressive',
    });
    const countdown = buildScriptPrompt({
      ...baseInput,
      inductionStyle: 'countdown',
    });
    expect(progressive).toContain('progressive muscle relaxation');
    expect(countdown).toContain('countdown induction from 10 to 1');
  });
});

describe('buildSafetyCheckPrompt', () => {
  it('wraps the script text in triple-quoted context', () => {
    const prompt = buildSafetyCheckPrompt('You are calm.');
    expect(prompt).toContain('"""');
    expect(prompt).toContain('You are calm.');
  });

  it('requests a JSON-only response shape', () => {
    const prompt = buildSafetyCheckPrompt('script');
    expect(prompt).toContain('JSON format only');
    expect(prompt).toContain('"safe"');
  });
});

describe('buildRegenerateParagraphPrompt', () => {
  it('omits context headers when no neighbours are supplied', () => {
    const prompt = buildRegenerateParagraphPrompt('Middle para.', null, null);
    expect(prompt).not.toContain('Previous paragraph');
    expect(prompt).not.toContain('Next paragraph');
    expect(prompt).toContain('Middle para.');
  });

  it('includes both neighbours when supplied', () => {
    const prompt = buildRegenerateParagraphPrompt(
      'Middle para.',
      'Before.',
      'After.',
    );
    expect(prompt).toContain('Previous paragraph for context: "Before."');
    expect(prompt).toContain('Next paragraph for context: "After."');
    expect(prompt).toContain('Paragraph to rewrite: "Middle para."');
  });
});
