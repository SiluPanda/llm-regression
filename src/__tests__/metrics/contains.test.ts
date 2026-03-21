import { describe, it, expect } from 'vitest';
import { containsScore } from '../../metrics/contains';

describe('containsScore', () => {
  describe('phrase containment mode', () => {
    it('returns 1.0 when all phrases are found', () => {
      const score = containsScore(
        '',
        'Paris is the capital of France and also a beautiful city.',
        { phrases: ['Paris', 'capital'] },
      );
      expect(score).toBe(1.0);
    });

    it('returns 0.0 when no phrases are found', () => {
      const score = containsScore('', 'Hello world', { phrases: ['Paris', 'capital'] });
      expect(score).toBe(0.0);
    });

    it('returns fractional score for partial matches', () => {
      const score = containsScore(
        '',
        'Paris is a beautiful city.',
        { phrases: ['Paris', 'capital', 'France'] },
      );
      expect(score).toBeCloseTo(1 / 3, 5);
    });

    it('is case-insensitive by default', () => {
      const score = containsScore('', 'paris is the capital of france.', {
        phrases: ['Paris', 'France'],
      });
      expect(score).toBe(1.0);
    });

    it('is case-sensitive when caseSensitive=true', () => {
      const score = containsScore('', 'paris is the capital of france.', {
        phrases: ['Paris', 'France'],
        caseSensitive: true,
      });
      expect(score).toBe(0.0);
    });

    it('handles single phrase', () => {
      expect(containsScore('', 'hello world', { phrases: ['hello'] })).toBe(1.0);
      expect(containsScore('', 'hello world', { phrases: ['goodbye'] })).toBe(0.0);
    });
  });

  describe('baseline containment mode (no phrases)', () => {
    it('returns 1.0 when baseline is fully contained in candidate', () => {
      expect(containsScore('capital of France', 'Paris is the capital of France.')).toBe(1.0);
    });

    it('returns 0.0 when baseline is not in candidate', () => {
      expect(containsScore('capital of Germany', 'Paris is the capital of France.')).toBe(0.0);
    });

    it('is case-insensitive by default', () => {
      expect(containsScore('CAPITAL OF FRANCE', 'Paris is the capital of France.')).toBe(1.0);
    });

    it('is case-sensitive when caseSensitive=true', () => {
      expect(
        containsScore('CAPITAL OF FRANCE', 'Paris is the capital of France.', {
          caseSensitive: true,
        }),
      ).toBe(0.0);
    });

    it('returns 1.0 when baseline equals candidate', () => {
      expect(containsScore('hello', 'hello')).toBe(1.0);
    });

    it('handles empty strings', () => {
      // Empty string is contained in everything
      expect(containsScore('', 'hello')).toBe(1.0);
      expect(containsScore('', '')).toBe(1.0);
    });
  });
});
