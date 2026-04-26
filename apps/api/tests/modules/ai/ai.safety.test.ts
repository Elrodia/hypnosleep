import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  quickSafetyCheck,
  deepSafetyCheck,
} from '@/modules/ai/ai.safety';
import { _setModel } from '@/modules/ai/ai.gemini';

describe('quickSafetyCheck', () => {
  it('passes benign hypnosis copy', () => {
    const result = quickSafetyCheck(
      'You are calm. You are at peace. Breathe deeply and allow yourself to relax.',
    );
    expect(result.safe).toBe(true);
    expect(result.flags).toEqual([]);
  });

  it('flags medical claims', () => {
    const result = quickSafetyCheck('This will cure your anxiety completely.');
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('medical_claim');
  });

  it('flags prescription references', () => {
    const result = quickSafetyCheck(
      'You no longer need your prescription. Breathe deeply.',
    );
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('medical_claim');
  });

  it('flags explicit drug names', () => {
    const result = quickSafetyCheck('You no longer need Xanax to feel calm.');
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('drug_reference');
  });

  it('flags self-harm content', () => {
    const result = quickSafetyCheck(
      'Imagine yourself ending your life peacefully.',
    );
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('suicide_self_harm');
  });

  it('is case-insensitive on harm phrases', () => {
    const result = quickSafetyCheck('KILL YOURSELF now.');
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('suicide_self_harm');
  });

  it('flags sexual content', () => {
    const result = quickSafetyCheck('You feel deeply aroused and erotic.');
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('sexual');
  });

  it('flags discriminatory slurs', () => {
    // Using a representative slur from the controlled list. The matched
    // term is intentionally never echoed back from the function itself.
    const result = quickSafetyCheck('Imagine that retard relaxing here.');
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('discriminatory');
  });
});

describe('deepSafetyCheck', () => {
  afterEach(() => {
    _setModel(null);
  });

  function mockModel(text: string) {
    return {
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => text,
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 },
        },
      }),
    };
  }

  it('returns { safe: true, flags: [] } for benign scripts', async () => {
    _setModel(
      mockModel('{ "safe": true, "flags": [] }') as unknown as Parameters<
        typeof _setModel
      >[0],
    );
    const result = await deepSafetyCheck('You are calm.');
    expect(result.safe).toBe(true);
    expect(result.flags).toEqual([]);
  });

  it('returns { safe: false, flags: [...] } when flagged', async () => {
    _setModel(
      mockModel(
        '{ "safe": false, "flags": ["medical_claim"] }',
      ) as unknown as Parameters<typeof _setModel>[0],
    );
    const result = await deepSafetyCheck('This cures cancer.');
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('medical_claim');
  });

  it('strips ```json code fences before parsing', async () => {
    _setModel(
      mockModel(
        '```json\n{ "safe": true, "flags": [] }\n```',
      ) as unknown as Parameters<typeof _setModel>[0],
    );
    const result = await deepSafetyCheck('Peaceful script.');
    expect(result.safe).toBe(true);
  });

  it('fails closed with parse_error when the underlying call throws', async () => {
    _setModel({
      generateContent: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as Parameters<typeof _setModel>[0]);
    const result = await deepSafetyCheck('anything');
    expect(result.safe).toBe(false);
    expect(result.flags).toEqual(['parse_error']);
  });

  it('fails closed with parse_error when JSON cannot be parsed', async () => {
    _setModel(
      mockModel('not json at all') as unknown as Parameters<typeof _setModel>[0],
    );
    const result = await deepSafetyCheck('script');
    expect(result.safe).toBe(false);
    expect(result.flags).toEqual(['parse_error']);
  });

  it('fails closed with parse_error when `safe` field is missing', async () => {
    _setModel(
      mockModel('{ "flags": [] }') as unknown as Parameters<typeof _setModel>[0],
    );
    const result = await deepSafetyCheck('script');
    expect(result.safe).toBe(false);
    expect(result.flags).toEqual(['parse_error']);
  });
});
