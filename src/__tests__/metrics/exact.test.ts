import { describe, it, expect } from 'vitest';
import { exactMatch } from '../../metrics/exact';

describe('exactMatch', () => {
  it('returns 1.0 for identical strings', () => {
    expect(exactMatch('hello world', 'hello world')).toBe(1.0);
  });

  it('returns 0.0 for different strings', () => {
    expect(exactMatch('hello world', 'hello there')).toBe(0.0);
  });

  it('is case-insensitive by default', () => {
    expect(exactMatch('Hello World', 'hello world')).toBe(1.0);
  });

  it('is case-sensitive when caseSensitive=true', () => {
    expect(exactMatch('Hello World', 'hello world', { caseSensitive: true })).toBe(0.0);
    expect(exactMatch('Hello World', 'Hello World', { caseSensitive: true })).toBe(1.0);
  });

  it('trims whitespace by default', () => {
    expect(exactMatch('  hello  ', 'hello')).toBe(1.0);
    expect(exactMatch('hello', '  hello  ')).toBe(1.0);
  });

  it('does not trim when trim=false', () => {
    expect(exactMatch('  hello  ', 'hello', { trim: false })).toBe(0.0);
  });

  it('normalizes internal whitespace by default', () => {
    expect(exactMatch('hello   world', 'hello world')).toBe(1.0);
    expect(exactMatch('hello\t\nworld', 'hello world')).toBe(1.0);
  });

  it('does not normalize whitespace when normalizeWhitespace=false', () => {
    expect(exactMatch('hello   world', 'hello world', { normalizeWhitespace: false })).toBe(0.0);
  });

  it('applies both trim and normalizeWhitespace together', () => {
    expect(exactMatch('  hello   world  ', '  hello world  ')).toBe(1.0);
  });

  it('handles empty strings', () => {
    expect(exactMatch('', '')).toBe(1.0);
    expect(exactMatch('', 'hello')).toBe(0.0);
    expect(exactMatch('hello', '')).toBe(0.0);
  });
});
