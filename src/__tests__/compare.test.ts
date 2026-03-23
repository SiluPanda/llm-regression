import { describe, it, expect } from 'vitest';
import { compare, compareBatch } from '../compare';
import type { TestCase } from '../types';

describe('compare', () => {
  it('returns a ComparisonResult with required fields', async () => {
    const result = await compare(
      'Paris is the capital of France.',
      'The capital of France is Paris.',
    );
    expect(result.testId).toBeDefined();
    expect(result.baseline).toBe('Paris is the capital of France.');
    expect(result.candidate).toBe('The capital of France is Paris.');
    expect(result.scores).toBeDefined();
    expect(typeof result.primaryScore).toBe('number');
    expect(['regression', 'improvement', 'neutral']).toContain(result.classification);
    expect(typeof result.diff).toBe('string');
    expect(typeof result.durationMs).toBe('number');
    expect(result.metricResults).toBeDefined();
  });

  it('uses default metrics [exact, jaccard, rouge-l]', async () => {
    const result = await compare('hello world', 'hello world');
    expect(result.scores).toHaveProperty('exact');
    expect(result.scores).toHaveProperty('jaccard');
    expect(result.scores).toHaveProperty('rouge-l');
  });

  it('classifies identical strings as neutral', async () => {
    const result = await compare('hello world', 'hello world', {
      metrics: ['exact'],
      thresholds: { exact: 1.0 },
    });
    expect(result.scores.exact).toBe(1.0);
    expect(result.classification).toBe('neutral');
  });

  it('classifies very different strings as regression', async () => {
    const result = await compare('apple orange banana', 'red green blue', {
      metrics: ['jaccard'],
      thresholds: { jaccard: 0.6 },
    });
    expect(result.scores.jaccard).toBe(0.0);
    expect(result.classification).toBe('regression');
  });

  it('uses single metric option', async () => {
    const result = await compare('hello', 'hello', {
      metric: 'exact',
    });
    expect(result.scores).toHaveProperty('exact');
    expect(result.scores.exact).toBe(1.0);
  });

  it('uses multiple metrics option', async () => {
    const result = await compare('the quick brown fox', 'the quick brown fox', {
      metrics: ['exact', 'jaccard'],
    });
    expect(result.scores.exact).toBe(1.0);
    expect(result.scores.jaccard).toBe(1.0);
  });

  it('respects custom threshold', async () => {
    const result = await compare('hello world', 'hello earth', {
      metrics: ['jaccard'],
      thresholds: { jaccard: 0.1 }, // very low threshold → neutral
    });
    expect(result.classification).toBe('neutral');
  });

  it('uses testCase.id for testId', async () => {
    const result = await compare(
      'baseline',
      'candidate',
      { metrics: ['jaccard'] },
      { id: 'my-test', baseline: 'baseline', candidate: 'candidate' },
    );
    expect(result.testId).toBe('my-test');
  });

  it('includes input when provided via testCase', async () => {
    const result = await compare(
      'Paris',
      'Paris',
      { metrics: ['exact'] },
      { baseline: 'Paris', candidate: 'Paris', input: 'What is the capital?' },
    );
    expect(result.input).toBe('What is the capital?');
  });

  it('includes diff in result', async () => {
    const result = await compare('hello world', 'hello earth', { metrics: ['jaccard'] });
    expect(result.diff).toBeTruthy();
  });

  it('handles custom metric via customMetricFn', async () => {
    const result = await compare('baseline', 'candidate', {
      metrics: ['custom'],
      customMetricFn: (_b, _c) => ({ score: 0.75 }),
      thresholds: { custom: 0.5 },
    });
    expect(result.scores.custom).toBe(0.75);
    expect(result.classification).toBe('neutral');
  });

  it('handles semantic metric returning NaN when no embedFn', async () => {
    const result = await compare('hello', 'hello', {
      metrics: ['semantic'],
    });
    expect(result.scores.semantic).toBeNaN();
  });

  it('classifies as neutral when all metrics produce NaN', async () => {
    const result = await compare('hello', 'world', { metrics: ['semantic'] });
    expect(result.classification).toBe('neutral');
    expect(isNaN(result.primaryScore)).toBe(true);
  });
});

describe('compareBatch', () => {
  const cases: TestCase[] = [
    { id: 'q1', baseline: 'Paris is the capital of France.', candidate: 'Paris is the capital of France.' },
    { id: 'q2', baseline: 'The sky is blue.', candidate: 'The sky is blue.' },
    { id: 'q3', baseline: 'Water is H2O.', candidate: 'Completely different answer here.' },
  ];

  it('returns a BatchReport with summary and results', async () => {
    const report = await compareBatch(cases, { metrics: ['jaccard'] });
    expect(report.summary.total).toBe(3);
    expect(report.results).toHaveLength(3);
    expect(report.metrics).toContain('jaccard');
    expect(report.timestamp).toBeDefined();
  });

  it('aggregates regressions, improvements, neutrals', async () => {
    const report = await compareBatch(cases, {
      metrics: ['jaccard'],
      thresholds: { jaccard: 0.6 },
    });
    // q1 and q2 are identical → neutral; q3 is different → regression
    expect(report.summary.neutral).toBeGreaterThanOrEqual(2);
    expect(report.regressions.length).toBeGreaterThanOrEqual(1);
    expect(report.regressions.length + report.neutrals.length + report.improvements.length).toBe(3);
  });

  it('computes passRate correctly', async () => {
    const report = await compareBatch(cases, {
      metrics: ['jaccard'],
      thresholds: { jaccard: 0.6 },
    });
    const expected = (report.summary.neutral + report.summary.improvements) / 3;
    expect(report.summary.passRate).toBeCloseTo(expected, 5);
  });

  it('marks overall as failed when passRate < aggregateThreshold', async () => {
    // All 3 cases will likely fail with very high threshold
    const allFailing: TestCase[] = [
      { id: 'a', baseline: 'abc', candidate: 'xyz' },
      { id: 'b', baseline: 'def', candidate: 'uvw' },
    ];
    const report = await compareBatch(allFailing, {
      metrics: ['jaccard'],
      thresholds: { jaccard: 0.6 },
      aggregateThreshold: 0.9,
    });
    expect(report.summary.passed).toBe(false);
  });

  it('marks overall as passed when all cases are neutral', async () => {
    const allNeutral: TestCase[] = [
      { id: 'a', baseline: 'same text here', candidate: 'same text here' },
      { id: 'b', baseline: 'another sentence', candidate: 'another sentence' },
    ];
    const report = await compareBatch(allNeutral, {
      metrics: ['jaccard'],
      thresholds: { jaccard: 0.6 },
      aggregateThreshold: 0.9,
    });
    expect(report.summary.passed).toBe(true);
    expect(report.summary.passRate).toBe(1.0);
  });

  it('calls onProgress callback', async () => {
    const progress: [number, number][] = [];
    await compareBatch(cases, {
      metrics: ['jaccard'],
      concurrency: 1,
      onProgress: (completed, total) => { progress.push([completed, total]); },
    });
    expect(progress.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1][0]).toBe(3);
    expect(progress[progress.length - 1][1]).toBe(3);
  });

  it('computes aggregateScores per metric', async () => {
    const report = await compareBatch(cases, { metrics: ['jaccard'] });
    expect(report.aggregateScores).toHaveProperty('jaccard');
    const stats = report.aggregateScores['jaccard'];
    expect(typeof stats.mean).toBe('number');
    expect(typeof stats.median).toBe('number');
    expect(typeof stats.min).toBe('number');
    expect(typeof stats.max).toBe('number');
    expect(typeof stats.stddev).toBe('number');
    expect(typeof stats.passRate).toBe('number');
  });

  it('handles empty testCases array', async () => {
    const report = await compareBatch([], { metrics: ['jaccard'] });
    expect(report.summary.total).toBe(0);
    expect(report.results).toHaveLength(0);
    expect(report.summary.passRate).toBe(1);
  });
});
