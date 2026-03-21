import { describe, it, expect } from 'vitest';
import { rougeL } from '../../metrics/rouge-l';

describe('rougeL', () => {
  it('returns 1.0 for identical strings', () => {
    expect(rougeL('the quick brown fox', 'the quick brown fox')).toBe(1.0);
  });

  it('returns 0.0 for completely disjoint strings', () => {
    expect(rougeL('cat dog bird', 'apple orange banana')).toBe(0.0);
  });

  it('returns 1.0 for two empty strings', () => {
    expect(rougeL('', '')).toBe(1.0);
  });

  it('returns 0.0 when one string is empty', () => {
    expect(rougeL('hello world', '')).toBe(0.0);
    expect(rougeL('', 'hello world')).toBe(0.0);
  });

  it('computes known LCS-based F1 score', () => {
    // baseline: "a b c d e" (5 tokens)
    // candidate: "a b c" (3 tokens)
    // LCS = 3 (a b c)
    // precision = 3/3 = 1.0, recall = 3/5 = 0.6
    // F1 = 2 * 1.0 * 0.6 / (1.0 + 0.6) = 1.2 / 1.6 = 0.75
    expect(rougeL('a b c d e', 'a b c')).toBeCloseTo(0.75, 5);
  });

  it('is case-insensitive', () => {
    expect(rougeL('Hello World', 'hello world')).toBe(1.0);
  });

  it('handles reordered words — LCS is sensitive to order', () => {
    // "paris is capital" vs "capital is paris"
    // LCS would be "is" (length 1) since order matters
    const score = rougeL('paris is capital', 'capital is paris');
    // LCS: "is" = 1 token
    // precision = 1/3, recall = 1/3
    // F1 = 2*(1/3)*(1/3)/(2/3) = (2/9)/(2/3) = 1/3
    expect(score).toBeCloseTo(1 / 3, 5);
  });

  it('scores partial overlap between sentences', () => {
    const a = 'Paris is the capital of France.';
    const b = 'The capital of France is Paris.';
    const score = rougeL(a, b);
    expect(score).toBeGreaterThan(0.5);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('handles single-word strings', () => {
    expect(rougeL('hello', 'hello')).toBe(1.0);
    expect(rougeL('hello', 'world')).toBe(0.0);
  });
});
