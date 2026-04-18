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

  it('flags self-harm content', () => {
    const result = quickSafetyCheck(
      'Imagine yourself ending your life peacefully.',
    );
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('suicide_self_harm');
  });

  it('is case-insensitive', () => {
    const result = quickSafetyCheck('KILL YOURSELF now.');
    expect(result.safe).toBe(false);
    expect(result.flags).toContain('suicide_self_harm');
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

  it('returns isSafe: true for benign scripts', async () => {
    _setModel(
      mockModel('{ "safe": true }') as unknown as Parameters<typeof _setModel>[0],
    );
    const result = await deepSafetyCheck('You are calm.');
    expect(result.isSafe).toBe(true);
  });

  it('returns isSafe: false with a reason when flagged', async () => {
    _setModel(
      mockModel(
        '{ "safe": false, "reason": "medical claim detected" }',
      ) as unknown as Parameters<typeof _setModel>[0],
    );
    const result = await deepSafetyCheck('This cures cancer.');
    expect(result.isSafe).toBe(false);
    expect(result.reason).toContain('medical claim');
  });

  it('strips ```json code fences before parsing', async () => {
    _setModel(
      mockModel('```json\n{ "safe": true }\n```') as unknown as Parameters<
        typeof _setModel
      >[0],
    );
    const result = await deepSafetyCheck('Peaceful script.');
    expect(result.isSafe).toBe(true);
  });

  it('defaults to safe when the underlying call throws', async () => {
    _setModel({
      generateContent: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as Parameters<typeof _setModel>[0]);
    const result = await deepSafetyCheck('anything');
    expect(result.isSafe).toBe(true);
  });
});
