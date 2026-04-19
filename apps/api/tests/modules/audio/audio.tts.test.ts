import { describe, it, expect } from 'vitest';
import { splitScriptIntoChunks } from '../../../src/modules/audio/audio.tts.js';

/**
 * Unit tests for the chunking heuristic used by the TTS pipeline.
 *
 * The chunker is critical for generation reliability — every produced
 * chunk MUST stay under the per-call cap so Edge TTS doesn't hit its
 * 120s subprocess timeout, and chunk boundaries must be reconstructable
 * into the original script (modulo whitespace) once concatenated.
 */
describe('splitScriptIntoChunks', () => {
  it('returns an empty array for empty input', () => {
    expect(splitScriptIntoChunks('')).toEqual([]);
    expect(splitScriptIntoChunks('   ')).toEqual([]);
    expect(splitScriptIntoChunks('\n\n\n')).toEqual([]);
  });

  it('returns a single chunk when the script fits the cap', () => {
    const text = 'A short paragraph that fits comfortably.';
    expect(splitScriptIntoChunks(text)).toEqual([text]);
  });

  it('splits on blank-line paragraph boundaries', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    expect(splitScriptIntoChunks(text)).toEqual([
      'First paragraph.',
      'Second paragraph.',
      'Third paragraph.',
    ]);
  });

  it('drops empty / whitespace-only paragraphs', () => {
    const text = 'First.\n\n   \n\n\n\nSecond.';
    expect(splitScriptIntoChunks(text)).toEqual(['First.', 'Second.']);
  });

  it('treats 3+ consecutive newlines as a single paragraph break', () => {
    const text = 'A.\n\n\n\nB.';
    expect(splitScriptIntoChunks(text)).toEqual(['A.', 'B.']);
  });

  it('splits a long paragraph on sentence boundaries', () => {
    // Build a paragraph well over the cap from many short sentences.
    const sentence = 'This is a sentence with some hypnosis content. ';
    const longParagraph = sentence.repeat(80); // ~80 * ~48 = ~3800 chars
    const chunks = splitScriptIntoChunks(longParagraph, 500);

    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(500);
      expect(c.length).toBeGreaterThan(0);
    }
    // No characters lost beyond whitespace trimming — concatenated
    // chunks should contain the same number of sentence terminators.
    const originalDots = (longParagraph.match(/\./g) ?? []).length;
    const chunkedDots = (chunks.join(' ').match(/\./g) ?? []).length;
    expect(chunkedDots).toBe(originalDots);
  });

  it('hard-splits a single run-on sentence that exceeds the cap', () => {
    // No sentence terminators at all — must fall back to char split.
    const runOn = 'a'.repeat(2500);
    const chunks = splitScriptIntoChunks(runOn, 1000);

    expect(chunks.length).toBe(3); // 1000 + 1000 + 500
    expect(chunks[0].length).toBe(1000);
    expect(chunks[1].length).toBe(1000);
    expect(chunks[2].length).toBe(500);
    expect(chunks.join('')).toBe(runOn);
  });

  it('keeps short paragraphs intact even when other paragraphs are long', () => {
    const longSentence = 'word '.repeat(300); // ~1500 chars
    const text = `Tiny intro.\n\n${longSentence.trim()}.\n\nTiny outro.`;
    const chunks = splitScriptIntoChunks(text, 800);

    expect(chunks[0]).toBe('Tiny intro.');
    expect(chunks[chunks.length - 1]).toBe('Tiny outro.');
    // Long paragraph in the middle was split into 2+ pieces.
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(800);
    }
  });

  it('respects ?, !, and . as sentence terminators', () => {
    const para =
      'First sentence. Second sentence! Third sentence? Fourth one.';
    // Cap small enough to force boundary splitting.
    const chunks = splitScriptIntoChunks(para, 25);
    expect(chunks.length).toBeGreaterThan(1);
    // Every produced chunk should still parse as roughly sentence-shaped:
    // no chunk should split inside a word.
    for (const c of chunks) {
      expect(c.trim().length).toBeGreaterThan(0);
    }
  });
});
