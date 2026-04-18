import { describe, it, expect } from 'vitest';
import { buildSessionKey } from '../../../src/modules/audio/audio.s3.js';

describe('audio.s3 helpers', () => {
  describe('buildSessionKey', () => {
    it('builds the canonical session audio key', () => {
      expect(buildSessionKey('user-123', 'sess-456')).toBe(
        'audio/user-123/sess-456.mp3',
      );
    });

    it('includes the user id as the first path segment', () => {
      const key = buildSessionKey('alice', 'abc');
      expect(key.startsWith('audio/alice/')).toBe(true);
    });

    it('always uses the .mp3 extension', () => {
      expect(buildSessionKey('u', 's').endsWith('.mp3')).toBe(true);
    });
  });
});
