import { describe, it, expect } from 'vitest';
import { generateSessionSchema, regenerateParagraphSchema } from '@/modules/ai/ai.schema';

describe('AI Schema — generateSessionSchema', () => {
  it('should accept valid input with defaults', () => {
    const result = generateSessionSchema.parse({
      prompt: 'Help me fall asleep quickly and peacefully',
    });

    expect(result.prompt).toBe('Help me fall asleep quickly and peacefully');
    expect(result.category).toBe('custom');
    expect(result.voiceId).toBe('en-US-AnaNeural');
    expect(result.backgroundSound).toBe('rain');
    expect(result.durationMinutes).toBe(15);
    expect(result.inductionStyle).toBe('progressive');
    expect(result.depthLevel).toBe('medium');
    expect(result.wakeUpEnding).toBe(true);
  });

  it('should accept fully specified input', () => {
    const result = generateSessionSchema.parse({
      prompt: 'Build my confidence for presentations',
      category: 'confidence',
      voiceId: 'en-GB-SoniaNeural',
      backgroundSound: 'ocean',
      durationMinutes: 20,
      inductionStyle: 'countdown',
      depthLevel: 'deep',
      wakeUpEnding: false,
    });

    expect(result.category).toBe('confidence');
    expect(result.voiceId).toBe('en-GB-SoniaNeural');
    expect(result.depthLevel).toBe('deep');
  });

  it('should reject prompt shorter than 10 characters', () => {
    const result = generateSessionSchema.safeParse({ prompt: 'short' });
    expect(result.success).toBe(false);
  });

  it('should reject prompt longer than 500 characters', () => {
    const result = generateSessionSchema.safeParse({ prompt: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('should reject invalid category', () => {
    const result = generateSessionSchema.safeParse({
      prompt: 'A valid prompt text here',
      category: 'invalid-category',
    });
    expect(result.success).toBe(false);
  });

  it('should reject duration below minimum', () => {
    const result = generateSessionSchema.safeParse({
      prompt: 'A valid prompt text here',
      durationMinutes: 2,
    });
    expect(result.success).toBe(false);
  });

  it('should reject duration above maximum', () => {
    const result = generateSessionSchema.safeParse({
      prompt: 'A valid prompt text here',
      durationMinutes: 60,
    });
    expect(result.success).toBe(false);
  });
});

describe('AI Schema — regenerateParagraphSchema', () => {
  it('should accept valid input', () => {
    const result = regenerateParagraphSchema.parse({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      paragraphIndex: 2,
      context: {
        previousParagraph: 'Previous text...',
        currentParagraph: 'Current text to regenerate...',
        nextParagraph: 'Next text...',
      },
    });

    expect(result.paragraphIndex).toBe(2);
    expect(result.context.currentParagraph).toBe('Current text to regenerate...');
  });

  it('should accept null for surrounding paragraphs', () => {
    const result = regenerateParagraphSchema.parse({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      paragraphIndex: 0,
      context: {
        previousParagraph: null,
        currentParagraph: 'First paragraph text...',
        nextParagraph: null,
      },
    });

    expect(result.context.previousParagraph).toBeNull();
    expect(result.context.nextParagraph).toBeNull();
  });

  it('should reject invalid session ID', () => {
    const result = regenerateParagraphSchema.safeParse({
      sessionId: 'not-a-uuid',
      paragraphIndex: 0,
      context: {
        previousParagraph: null,
        currentParagraph: 'Text',
        nextParagraph: null,
      },
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative paragraph index', () => {
    const result = regenerateParagraphSchema.safeParse({
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      paragraphIndex: -1,
      context: {
        previousParagraph: null,
        currentParagraph: 'Text',
        nextParagraph: null,
      },
    });
    expect(result.success).toBe(false);
  });
});
