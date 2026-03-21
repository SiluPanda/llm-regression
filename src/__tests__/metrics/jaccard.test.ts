import { describe, it, expect } from 'vitest';
import { jaccardSimilarity } from '../../metrics/jaccard';

describe('jaccardSimilarity', () => {
  it('returns 1.0 for identical strings', () => {
    expect(jaccardSimilarity('the quick brown fox', 'the quick brown fox')).toBe(1.0);
  });

  it('returns 0.0 for completely disjoint token sets', () => {
    expect(jaccardSimilarity('cat dog bird', 'apple orange banana')).toBe(0.0);
  });

  it('returns 1.0 for two empty strings', () => {
    expect(jaccardSimilarity('', '')).toBe(1.0);
  });

  it('returns 0.0 when one string is empty', () => {
    expect(jaccardSimilarity('hello', '')).toBe(0.0);
    expect(jaccardSimilarity('', 'hello')).toBe(0.0);
  });

  it('computes partial overlap correctly', () => {
    // "hello world" vs "hello there"
    // tokens A = {hello, world}, B = {hello, there}
    // intersection = 1 (hello), union = 3 (hello, world, there)
    expect(jaccardSimilarity('hello world', 'hello there')).toBeCloseTo(1 / 3, 5);
  });

  it('is case-insensitive by default', () => {
    expect(jaccardSimilarity('Hello World', 'hello world')).toBe(1.0);
  });

  it('is case-sensitive when caseSensitive=true', () => {
    // "Hello" !== "hello" so intersection = 0, union = 2
    expect(jaccardSimilarity('Hello', 'hello', { caseSensitive: true })).toBe(0.0);
  });

  it('removes stopwords when removeStopwords=true', () => {
    // "the cat" -> {cat}, "the dog" -> {dog}
    // intersection = 0, union = 2 → 0.0
    expect(jaccardSimilarity('the cat', 'the dog', { removeStopwords: true })).toBe(0.0);

    // "the cat" -> {cat}, "the cat" -> {cat}
    // intersection = 1, union = 1 → 1.0
    expect(jaccardSimilarity('the cat', 'the cat', { removeStopwords: true })).toBe(1.0);
  });

  it('Paris capitals sentence has reasonable overlap', () => {
    const a = 'Paris is the capital of France.';
    const b = 'The capital of France is Paris.';
    const score = jaccardSimilarity(a, b);
    // Both sentences share the same meaningful words
    expect(score).toBeGreaterThan(0.5);
  });

  it('handles repeated tokens (treats as sets)', () => {
    // "cat cat dog" → set {cat, dog}
    // "cat fish" → set {cat, fish}
    // intersection = {cat}, union = {cat, dog, fish} → 1/3
    expect(jaccardSimilarity('cat cat dog', 'cat fish')).toBeCloseTo(1 / 3, 5);
  });
});
