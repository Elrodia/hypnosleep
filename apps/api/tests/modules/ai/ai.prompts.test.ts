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

  it('includes the target word count derived from duration (150 wpm)', () => {
    const prompt = buildScriptPrompt({ ...baseInput, durationMinutes: 10 });
    // 10 × 150 = 1500 words
    expect(prompt).toContain('1500 words');
  });

  it('uses a sleep fade-out when wakeUpEnding is false', () => {
    const prompt = buildScriptPrompt({ ...baseInput, wakeUpEnding: false });
    expect(prompt.toLowerCase()).toContain('fade gently into sleep');
  });

  it('uses a count-up wake-up ending when wakeUpEnding is true', () => {
    const prompt = buildScriptPrompt({
      ...baseInput,
      wakeUpEnding: true,
      category: 'confidence',
    });
    expect(prompt).toContain('count up 1 → 5');
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
    expect(countdown).toContain('countdown induction');
  });

  it('demands strict JSON output with the {title, scriptText, estimatedSeconds} envelope', () => {
    const prompt = buildScriptPrompt(baseInput);
    expect(prompt).toContain('STRICT JSON');
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"scriptText"');
    expect(prompt).toContain('"estimatedSeconds"');
  });

  it('mentions all five sections with their target proportions', () => {
    const prompt = buildScriptPrompt(baseInput);
    expect(prompt).toContain('Induction (≈20%)');
    expect(prompt).toContain('Deepening (≈15%)');
    expect(prompt).toContain('Suggestion (≈50%)');
    expect(prompt).toContain('Integration (≈10%)');
  });

  it('asks the model to insert SSML <break> tags', () => {
    const prompt = buildScriptPrompt(baseInput);
    expect(prompt).toContain('<break time="2s"/>');
    expect(prompt).toContain('<break time="3s"/>');
  });
});

describe('buildSafetyCheckPrompt', () => {
  it('wraps the script text in triple-quoted context', () => {
    const prompt = buildSafetyCheckPrompt('You are calm.');
    expect(prompt).toContain('"""');
    expect(prompt).toContain('You are calm.');
  });

  it('requests a strict-JSON response with safe + flags fields', () => {
    const prompt = buildSafetyCheckPrompt('script');
    expect(prompt).toContain('STRICT JSON');
    expect(prompt).toContain('"safe"');
    expect(prompt).toContain('"flags"');
  });

  it('lists the controlled-vocabulary flag tokens', () => {
    const prompt = buildSafetyCheckPrompt('script');
    for (const flag of [
      'medical_claim',
      'drug_reference',
      'harmful_to_vulnerable',
      'sexual',
      'discriminatory',
      'physical_harm',
      'suicide_self_harm',
    ]) {
      expect(prompt).toContain(flag);
    }
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
