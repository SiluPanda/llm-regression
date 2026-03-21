import { describe, it, expect } from 'vitest';
import { structuralSimilarity } from '../../metrics/structural';

describe('structuralSimilarity', () => {
  it('returns 0.0 when baseline is not valid JSON', () => {
    expect(structuralSimilarity('not json', '{"key": "value"}')).toBe(0.0);
  });

  it('returns 0.0 when candidate is not valid JSON', () => {
    expect(structuralSimilarity('{"key": "value"}', 'not json')).toBe(0.0);
  });

  it('returns 0.0 when both are invalid JSON', () => {
    expect(structuralSimilarity('bad', 'also bad')).toBe(0.0);
  });

  it('returns 1.0 for identical flat objects', () => {
    const a = '{"name": "Alice", "age": 30}';
    const b = '{"name": "Bob", "age": 25}';
    // Same structure (same keys, same types)
    expect(structuralSimilarity(a, b)).toBe(1.0);
  });

  it('returns 1.0 for identical primitives', () => {
    expect(structuralSimilarity('"hello"', '"world"')).toBe(1.0);
    expect(structuralSimilarity('42', '99')).toBe(1.0);
    expect(structuralSimilarity('true', 'false')).toBe(1.0);
    expect(structuralSimilarity('null', 'null')).toBe(1.0);
  });

  it('returns 0.0 for mismatched primitive types', () => {
    expect(structuralSimilarity('"hello"', '42')).toBe(0.0);
    expect(structuralSimilarity('true', 'null')).toBe(0.0);
  });

  it('penalizes missing keys by default (allowMissingKeys=false)', () => {
    const a = '{"name": "Alice", "age": 30, "city": "Paris"}';
    const b = '{"name": "Bob"}';
    const score = structuralSimilarity(a, b);
    // 3 keys in baseline; only "name" matches → 1/3
    expect(score).toBeCloseTo(1 / 3, 5);
  });

  it('does not penalize missing keys when allowMissingKeys=true', () => {
    const a = '{"name": "Alice", "age": 30}';
    const b = '{"name": "Bob"}';
    // "name" matches → 1/1 (age not counted against score)
    const score = structuralSimilarity(a, b, { allowMissingKeys: true });
    expect(score).toBe(1.0);
  });

  it('penalizes extra keys by default (allowExtraKeys=false)', () => {
    const a = '{"name": "Alice"}';
    const b = '{"name": "Bob", "age": 30, "city": "Paris"}';
    // 1 matching + 2 extra penalty = 1 / 3
    const score = structuralSimilarity(a, b);
    expect(score).toBeCloseTo(1 / 3, 5);
  });

  it('does not penalize extra keys when allowExtraKeys=true', () => {
    const a = '{"name": "Alice"}';
    const b = '{"name": "Bob", "age": 30}';
    const score = structuralSimilarity(a, b, { allowExtraKeys: true });
    expect(score).toBe(1.0);
  });

  it('returns 1.0 for empty objects', () => {
    expect(structuralSimilarity('{}', '{}')).toBe(1.0);
  });

  it('compares nested object types', () => {
    const a = '{"user": {"name": "Alice", "age": 30}}';
    const b = '{"user": {"name": "Bob", "age": 25}}';
    expect(structuralSimilarity(a, b)).toBe(1.0);
  });

  it('returns 0.0 for type mismatch at nested level', () => {
    const a = '{"user": {"name": "Alice"}}';
    const b = '{"user": "Bob"}';
    // "user" key exists but type mismatch (object vs string) → 0/1
    const score = structuralSimilarity(a, b);
    expect(score).toBe(0.0);
  });

  it('handles arrays', () => {
    const a = '[1, 2, 3]';
    const b = '[4, 5, 6]';
    // Same type (number) at each index
    expect(structuralSimilarity(a, b)).toBe(1.0);
  });

  it('penalizes array length mismatch when checkArrayLength=true', () => {
    const a = '[1, 2, 3]';
    const b = '[1, 2]';
    expect(structuralSimilarity(a, b, { checkArrayLength: true })).toBe(0.0);
  });

  it('does not penalize array length mismatch when checkArrayLength=false', () => {
    const a = '[1, 2, 3]';
    const b = '[1, 2]';
    // Compares min(3, 2) = 2 elements
    expect(structuralSimilarity(a, b, { checkArrayLength: false })).toBe(1.0);
  });
});
