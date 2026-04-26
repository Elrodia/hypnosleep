import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateScript,
  regenerateParagraph,
  checkScriptSafety,
  _setModel,
} from '@/modules/ai/ai.service';
import type { GenerateSessionInput } from '@/modules/ai/ai.types';

// Mock Gemini model
function createMockModel(responseText: string, usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number }) {
  return {
    generateContent: vi.fn().mockResolvedValue({
      response: {
        text: () => responseText,
        usageMetadata: usageMetadata ?? {
          promptTokenCount: 100,
          candidatesTokenCount: 500,
        },
      },
    }),
  };
}

const sampleInput: GenerateSessionInput = {
  userId: 'user-123',
  prompt: 'Help me fall asleep quickly and peacefully',
  category: 'sleep',
  voiceId: 'en-US-AnaNeural',
  backgroundSound: 'rain',
  durationMinutes: 15,
  inductionStyle: 'progressive',
  depthLevel: 'medium',
  wakeUpEnding: true,
};

describe('AI Service — generateScript', () => {
  afterEach(() => {
    _setModel(null);
  });

  it('should generate a script with title and body from the JSON envelope', async () => {
    const envelope = JSON.stringify({
      title: 'Peaceful Slumber Awaits',
      scriptText:
        'Close your eyes and take a deep breath in... and slowly let it out.\n\nYour body is becoming heavier with each breath. You are safe and calm.\n\nAs you drift deeper, positive suggestions take root in your mind.',
      estimatedSeconds: 900,
    });

    const mockModel = createMockModel(envelope);
    _setModel(mockModel as unknown as Parameters<typeof _setModel>[0]);

    const result = await generateScript(sampleInput);

    expect(result.title).toBe('Peaceful Slumber Awaits');
    expect(result.scriptText).toContain('Close your eyes');
    expect(result.scriptText).toContain('positive suggestions');
    expect(result.estimatedSeconds).toBe(900);
    expect(result.tokensInput).toBe(100);
    expect(result.tokensOutput).toBe(500);
    expect(result.generationMs).toBeGreaterThanOrEqual(0);
    expect(mockModel.generateContent).toHaveBeenCalledOnce();
  });

  it('should throw when Gemini returns empty response', async () => {
    const mockModel = createMockModel('');
    _setModel(mockModel as unknown as Parameters<typeof _setModel>[0]);

    await expect(generateScript(sampleInput)).rejects.toThrow(
      'Gemini returned an empty response',
    );
  });

  it('should truncate title to 50 characters', async () => {
    const longTitle = 'A'.repeat(80);
    const envelope = JSON.stringify({
      title: longTitle,
      scriptText: 'Some script body text here.',
      estimatedSeconds: 600,
    });

    const mockModel = createMockModel(envelope);
    _setModel(mockModel as unknown as Parameters<typeof _setModel>[0]);

    const result = await generateScript(sampleInput);
    expect(result.title.length).toBeLessThanOrEqual(50);
  });

  it('should strip ```json code fences from the JSON envelope', async () => {
    const envelope =
      '```json\n' +
      JSON.stringify({
        title: 'My Session Title',
        scriptText: 'Script body paragraph one.\n\nParagraph two.',
        estimatedSeconds: 600,
      }) +
      '\n```';

    const mockModel = createMockModel(envelope);
    _setModel(mockModel as unknown as Parameters<typeof _setModel>[0]);

    const result = await generateScript(sampleInput);
    expect(result.title).toBe('My Session Title');
    expect(result.scriptText).toContain('Paragraph two.');
  });

  it('should reject the response when JSON cannot be parsed', async () => {
    const mockModel = createMockModel('this is not json at all');
    _setModel(mockModel as unknown as Parameters<typeof _setModel>[0]);

    await expect(generateScript(sampleInput)).rejects.toThrow(
      'Gemini returned invalid JSON envelope',
    );
  });

  it('should reject content with safety flags as a 400 GENERATION_FAILED', async () => {
    const envelope = JSON.stringify({
      title: 'Calm Flight',
      // `cure your` is a quick-safety medical_claim trigger.
      scriptText:
        'You may notice that this will cure your fear of flying forever.',
      estimatedSeconds: 600,
    });

    const mockModel = createMockModel(envelope);
    _setModel(mockModel as unknown as Parameters<typeof _setModel>[0]);

    await expect(
      generateScript({ ...sampleInput, category: 'sleep' }),
    ).rejects.toMatchObject({
      code: 'GENERATION_FAILED',
      statusCode: 400,
      details: { safetyFlags: expect.arrayContaining(['medical_claim']) },
    });
  });

  it('should bail out without retrying when Gemini reports a daily/free-tier quota exhaustion', async () => {
    // Mirrors the shape of `GoogleGenerativeAIFetchError` for a 429 with
    // a `QuotaFailure` whose `quotaId` matches `*PerDay*`. Retrying
    // within the same window cannot succeed, so the service must
    // short-circuit instead of burning the full retry budget.
    const quotaErr = Object.assign(new Error('429 quota exceeded'), {
      status: 429,
      errorDetails: [
        {
          '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
          violations: [
            {
              quotaId:
                'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
              quotaMetric:
                'generativelanguage.googleapis.com/generate_content_free_tier_requests',
            },
          ],
        },
        {
          '@type': 'type.googleapis.com/google.rpc.RetryInfo',
          retryDelay: '24s',
        },
      ],
    });

    const generateContent = vi.fn().mockRejectedValue(quotaErr);
    _setModel({ generateContent } as unknown as Parameters<typeof _setModel>[0]);

    await expect(generateScript(sampleInput)).rejects.toMatchObject({
      code: 'QUOTA_EXHAUSTED',
      statusCode: 429,
    });

    // Critically: only one call — no retries on a per-day quota.
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});

describe('AI Service — regenerateParagraph', () => {
  afterEach(() => {
    _setModel(null);
  });

  it('should regenerate a paragraph with context', async () => {
    const regenerated = 'Your body melts into a state of profound relaxation...';
    const mockModel = createMockModel(regenerated);
    _setModel(mockModel as unknown as Parameters<typeof _setModel>[0]);

    const result = await regenerateParagraph(
      'You are relaxing.',
      'Close your eyes.',
      'You are falling asleep.',
    );

    expect(result).toBe(regenerated);
    expect(mockModel.generateContent).toHaveBeenCalledOnce();

    // Verify the prompt includes context
    const callArg = mockModel.generateContent.mock.calls[0][0] as string;
    expect(callArg).toContain('Previous paragraph');
    expect(callArg).toContain('Next paragraph');
  });

  it('should work without surrounding paragraph context', async () => {
    const regenerated = 'A calmer version of the paragraph.';
    const mockModel = createMockModel(regenerated);
    _setModel(mockModel as unknown as Parameters<typeof _setModel>[0]);

    const result = await regenerateParagraph(
      'You are relaxing.',
      null,
      null,
    );

    expect(result).toBe(regenerated);
    const callArg = mockModel.generateContent.mock.calls[0][0] as string;
    expect(callArg).not.toContain('Previous paragraph');
    expect(callArg).not.toContain('Next paragraph');
  });

  it('should throw when Gemini returns empty text', async () => {
    const mockModel = createMockModel('');
    _setModel(mockModel as unknown as Parameters<typeof _setModel>[0]);

    await expect(
      regenerateParagraph('Test paragraph.', null, null),
    ).rejects.toThrow('Gemini returned an empty regeneration');
  });
});

describe('AI Service — checkScriptSafety', () => {
  afterEach(() => {
    _setModel(null);
  });

  it('should return { safe: true, flags: [] } for a normal script', async () => {
    const mockModel = createMockModel('{ "safe": true, "flags": [] }');
    _setModel(mockModel as unknown as Parameters<typeof _setModel>[0]);

    const result = await checkScriptSafety('You are relaxing deeply...');
    expect(result.safe).toBe(true);
    expect(result.flags).toEqual([]);
  });

  it('should return { safe: false, flags: [...] } for harmful content', async () => {
    const mockModel = createMockModel(
      '{ "safe": false, "flags": ["medical_claim"] }',
    );
    _setModel(mockModel as unknown as Parameters<typeof _setModel>[0]);

    const result = await checkScriptSafety('This will cure your cancer...');
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('medical_claim');
  });

  it('should handle JSON wrapped in markdown code blocks', async () => {
    const mockModel = createMockModel(
      '```json\n{ "safe": true, "flags": [] }\n```',
    );
    _setModel(mockModel as unknown as Parameters<typeof _setModel>[0]);

    const result = await checkScriptSafety('Peaceful script text');
    expect(result.safe).toBe(true);
  });

  it('should fail closed (parse_error) when the safety check itself fails', async () => {
    const mockModel = {
      generateContent: vi.fn().mockRejectedValue(new Error('API error')),
    };
    _setModel(mockModel as unknown as Parameters<typeof _setModel>[0]);

    const result = await checkScriptSafety('Some script');
    expect(result.safe).toBe(false);
    expect(result.flags).toEqual(['parse_error']);
  });
});
