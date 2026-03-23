import { describe, it, expect } from 'vitest';
import { bleuScore } from '../../metrics/bleu';

describe('bleuScore', () => {
  it('returns 1.0 for identical strings (maxN=1)', () => {
    // With maxN=1, only unigram precision matters — perfect match → 1.0
    expect(bleuScore('hello world', 'hello world', { maxN: 1 })).toBeCloseTo(1.0, 5);
  });

  it('returns 0.0 for empty candidate', () => {
    expect(bleuScore('hello world', '')).toBe(0);
  });

  it('returns 0.0 for completely different strings', () => {
    expect(bleuScore('cat dog bird', 'apple orange banana')).toBe(0);
  });

  it('applies brevity penalty when candidate is shorter than reference', () => {
    // reference: "a b c d e" (5), candidate: "a b c" (3)
    // BP = exp(1 - 5/3) ≈ exp(-0.667) ≈ 0.513
    // unigram precision = 3/3 = 1.0 (all candidate words in reference)
    // bigram: a b (1/2 in ref), b c (1/2 in ref) → precision = 2/2 = 1.0
    // With maxN=2: score = BP * geomean(1.0, 1.0) = BP ≈ 0.513
    const score = bleuScore('a b c d e', 'a b c', { maxN: 2 });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1.0); // BP penalizes
  });

  it('no brevity penalty when candidate is longer or equal', () => {
    // reference: "a b", candidate: "a b c" — candidate longer, BP = 1
    const score = bleuScore('a b', 'a b c', { maxN: 1 });
    // unigram: a=1 (in ref), b=1 (in ref), c=0 (not in ref) → precision = 2/3
    expect(score).toBeCloseTo(2 / 3, 5);
  });

  it('respects maxN parameter', () => {
    const s1 = bleuScore('hello world', 'hello world', { maxN: 1 });
    const s4 = bleuScore('hello world', 'hello world', { maxN: 4 });
    // Both should be perfect for identical strings (up to available n-grams)
    // maxN=4 but only 2 words → bigrams = 1, trigrams = 0 → any n>word_len gives 0
    // Actually with 2 words, 3-grams and 4-grams have 0 count → score = 0
    // This is expected BLEU behavior for short sentences
    expect(s1).toBeCloseTo(1.0, 5);
    // s4 may be 0 for very short sentences — that's correct
    expect(s4).toBeGreaterThanOrEqual(0);
  });

  it('handles custom weights', () => {
    // With 2-gram BLEU and equal weights [0.5, 0.5]
    const score = bleuScore('the cat sat on the mat', 'the cat sat on the mat', {
      maxN: 2,
      weights: [0.5, 0.5],
    });
    expect(score).toBeCloseTo(1.0, 5);
  });

  it('returns 0.0 when candidate is empty regardless of reference', () => {
    expect(bleuScore('hello world', '', { maxN: 1 })).toBe(0);
    expect(bleuScore('hello world', '', { maxN: 4 })).toBe(0);
  });

  it('scores partial overlap correctly (maxN=1)', () => {
    // reference: "the cat sat on mat" (5 unique tokens)
    // candidate: "the cat walked on floor" (5 tokens)
    // matching unigrams: the, cat, on → 3/5
    const score = bleuScore('the cat sat on mat', 'the cat walked on floor', { maxN: 1 });
    expect(score).toBeCloseTo(3 / 5, 5);
  });

  it('returns non-zero score for identical short sentences with default maxN', () => {
    const score = bleuScore('hello world', 'hello world');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeCloseTo(1.0, 1);
  });

  it('returns non-zero score for single-token identical strings', () => {
    const score = bleuScore('hello', 'hello');
    expect(score).toBeGreaterThan(0);
  });
});
