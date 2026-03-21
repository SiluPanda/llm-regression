/**
 * Compile-time shape checks for all exported types in src/types.ts.
 *
 * These tests use TypeScript's structural typing to verify that:
 * - Required fields cannot be omitted (checked via assignability).
 * - Optional fields are truly optional.
 * - Union types cover the expected set of values.
 * - Interfaces can be mock-implemented.
 * - Inheritance/extension relationships hold.
 *
 * Each test uses the `satisfies` operator or explicit typed variables to let
 * the compiler reject any shape that does not conform.  Runtime assertions
 * (`expect`) are added where they add clarity, but the primary verification
 * is compile-time.
 */

import { describe, it, expect } from 'vitest';
import type {
  MetricId,
  MetricThresholds,
  MetricScores,
  Classification,
  ClassificationMode,
  EmbedFn,
  LlmFn,
  CustomMetricFn,
  CustomMetricResult,
  TestCase,
  TestInput,
  ComparisonResult,
  MetricStats,
  BatchSummary,
  BatchReport,
  RegressionReport,
  CompareOptions,
  BatchOptions,
  RegressionOptions,
  RegressionConfig,
  RegressionTester,
  BaselineEntry,
  BaselineFile,
  SaveBaselineOptions,
} from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Accepts a value whose type is T.  Used to force the compiler to check that a
 * literal satisfies a particular interface shape, producing a compile error if it
 * does not.
 */
function accepts<T>(_value: T): void {
  // intentionally empty — compile-time only
}

// ── MetricId union ────────────────────────────────────────────────────────────

describe('MetricId', () => {
  it('covers all 8 expected members', () => {
    const all: MetricId[] = [
      'semantic',
      'jaccard',
      'rouge-l',
      'bleu',
      'exact',
      'contains',
      'structural',
      'custom',
    ];
    expect(all).toHaveLength(8);
  });

  it('rejects unknown strings at compile time', () => {
    // @ts-expect-error — 'unknown-metric' is not assignable to MetricId
    const _bad: MetricId = 'unknown-metric';
    expect(_bad).toBeDefined(); // suppress unused-variable lint
  });
});

// ── Classification union ──────────────────────────────────────────────────────

describe('Classification', () => {
  it('covers regression, improvement, and neutral', () => {
    const all: Classification[] = ['regression', 'improvement', 'neutral'];
    expect(all).toHaveLength(3);
  });

  it('rejects unknown strings at compile time', () => {
    // @ts-expect-error — 'pass' is not a valid Classification
    const _bad: Classification = 'pass';
    expect(_bad).toBeDefined();
  });
});

// ── ClassificationMode union ──────────────────────────────────────────────────

describe('ClassificationMode', () => {
  it('covers any and all', () => {
    const all: ClassificationMode[] = ['any', 'all'];
    expect(all).toHaveLength(2);
  });
});

// ── Function types ────────────────────────────────────────────────────────────

describe('EmbedFn', () => {
  it('accepts an async function returning number[]', () => {
    const fn: EmbedFn = async (_text: string) => [0.1, 0.2, 0.3];
    accepts<EmbedFn>(fn);
    expect(typeof fn).toBe('function');
  });
});

describe('LlmFn', () => {
  it('accepts an async function returning string', () => {
    const fn: LlmFn = async (_prompt: string) => 'output';
    accepts<LlmFn>(fn);
    expect(typeof fn).toBe('function');
  });
});

describe('CustomMetricFn', () => {
  it('accepts a function returning CustomMetricResult', () => {
    const fn: CustomMetricFn = (_baseline: string, _candidate: string): CustomMetricResult => ({
      score: 0.9,
    });
    accepts<CustomMetricFn>(fn);
    expect(typeof fn).toBe('function');
  });

  it('accepts an async function returning CustomMetricResult', () => {
    const fn: CustomMetricFn = async (
      _baseline: string,
      _candidate: string,
    ): Promise<CustomMetricResult> => ({ score: 0.75, details: 'ok' });
    accepts<CustomMetricFn>(fn);
    expect(typeof fn).toBe('function');
  });
});

describe('CustomMetricResult', () => {
  it('requires score, details is optional', () => {
    const minimal: CustomMetricResult = { score: 1.0 };
    const full: CustomMetricResult = { score: 0.5, details: 'partial match' };
    expect(minimal.score).toBe(1.0);
    expect(full.details).toBe('partial match');
  });

  it('rejects missing score at compile time', () => {
    // @ts-expect-error — score is required
    const _bad: CustomMetricResult = { details: 'missing score' };
    expect(_bad).toBeDefined();
  });
});

// ── TestInput ─────────────────────────────────────────────────────────────────

describe('TestInput', () => {
  it('requires input field', () => {
    const minimal: TestInput = { input: 'What is the capital of France?' };
    expect(minimal.input).toBe('What is the capital of France?');
  });

  it('allows all optional fields', () => {
    const full: TestInput = {
      id: 'capital',
      input: 'What is the capital of France?',
      metadata: { category: 'geography' },
      thresholds: { jaccard: 0.6, semantic: 0.85 },
      groundTruth: 'Paris is the capital of France.',
    };
    expect(full.id).toBe('capital');
    expect(full.groundTruth).toBe('Paris is the capital of France.');
    expect(full.thresholds?.jaccard).toBe(0.6);
  });

  it('rejects missing input at compile time', () => {
    // @ts-expect-error — input is required
    const _bad: TestInput = { id: 'no-input' };
    expect(_bad).toBeDefined();
  });
});

// ── TestCase ──────────────────────────────────────────────────────────────────

describe('TestCase', () => {
  it('requires baseline and candidate', () => {
    const minimal: TestCase = {
      baseline: 'Paris is the capital of France.',
      candidate: 'The capital of France is Paris.',
    };
    expect(minimal.baseline).toBeTruthy();
    expect(minimal.candidate).toBeTruthy();
  });

  it('id, input, metadata, thresholds are optional', () => {
    const full: TestCase = {
      id: 'q1',
      input: 'What is the capital of France?',
      baseline: 'Paris is the capital of France.',
      candidate: 'The capital of France is Paris.',
      metadata: { topic: 'geography', difficulty: 'easy' },
      thresholds: { semantic: 0.9, jaccard: 0.55 },
    };
    expect(full.id).toBe('q1');
    expect(full.metadata?.topic).toBe('geography');
  });

  it('rejects missing baseline at compile time', () => {
    // @ts-expect-error — baseline is required
    const _bad: TestCase = { candidate: 'only candidate' };
    expect(_bad).toBeDefined();
  });

  it('rejects missing candidate at compile time', () => {
    // @ts-expect-error — candidate is required
    const _bad: TestCase = { baseline: 'only baseline' };
    expect(_bad).toBeDefined();
  });
});

// ── ComparisonResult ──────────────────────────────────────────────────────────

describe('ComparisonResult', () => {
  it('has all required fields', () => {
    const result: ComparisonResult = {
      testId: 'q1',
      baseline: 'Paris is the capital of France.',
      candidate: 'The capital of France is Paris.',
      scores: { jaccard: 0.857 },
      primaryScore: 0.857,
      classification: 'neutral',
      diff: '- Paris is the capital of France.\n+ The capital of France is Paris.',
      durationMs: 2,
      metricResults: {
        jaccard: { score: 0.857, threshold: 0.6, passed: true },
      },
    };
    expect(result.testId).toBe('q1');
    expect(result.primaryScore).toBe(0.857);
    expect(result.classification).toBe('neutral');
  });

  it('input is optional', () => {
    const withInput: ComparisonResult = {
      testId: 'q2',
      baseline: '2 + 2 = 4.',
      candidate: 'The answer is 4.',
      input: 'What is 2 + 2?',
      scores: { jaccard: 0.25 },
      primaryScore: 0.25,
      classification: 'regression',
      diff: '...',
      durationMs: 1,
      metricResults: {
        jaccard: { score: 0.25, threshold: 0.6, passed: false },
      },
    };
    expect(withInput.input).toBe('What is 2 + 2?');
  });

  it('rejects missing testId at compile time', () => {
    // @ts-expect-error — testId is required
    const _bad: ComparisonResult = {
      baseline: 'a',
      candidate: 'b',
      scores: {},
      primaryScore: 0,
      classification: 'neutral',
      diff: '',
      durationMs: 0,
      metricResults: {},
    };
    expect(_bad).toBeDefined();
  });
});

// ── MetricStats ───────────────────────────────────────────────────────────────

describe('MetricStats', () => {
  it('has all required numeric fields', () => {
    const stats: MetricStats = {
      mean: 0.82,
      median: 0.86,
      min: 0.41,
      max: 1.0,
      stddev: 0.16,
      passRate: 0.9,
    };
    expect(stats.mean).toBe(0.82);
    expect(stats.median).toBe(0.86);
    expect(stats.stddev).toBe(0.16);
    expect(stats.passRate).toBe(0.9);
  });
});

// ── BatchSummary ──────────────────────────────────────────────────────────────

describe('BatchSummary', () => {
  it('has total, neutral, improvements, regressions, passRate, passed', () => {
    const summary: BatchSummary = {
      total: 10,
      neutral: 9,
      improvements: 0,
      regressions: 1,
      passRate: 0.9,
      passed: true,
    };
    expect(summary.total).toBe(10);
    expect(summary.neutral).toBe(9);
    expect(summary.improvements).toBe(0);
    expect(summary.regressions).toBe(1);
    expect(summary.passRate).toBe(0.9);
    expect(summary.passed).toBe(true);
  });

  it('rejects missing passed at compile time', () => {
    // @ts-expect-error — passed is required
    const _bad: BatchSummary = {
      total: 5,
      neutral: 5,
      improvements: 0,
      regressions: 0,
      passRate: 1.0,
    };
    expect(_bad).toBeDefined();
  });
});

// ── BatchReport ───────────────────────────────────────────────────────────────

describe('BatchReport', () => {
  it('can be constructed with all required fields', () => {
    const report: BatchReport = {
      summary: {
        total: 2,
        neutral: 2,
        improvements: 0,
        regressions: 0,
        passRate: 1.0,
        passed: true,
      },
      metrics: ['jaccard'],
      thresholds: { jaccard: 0.6 },
      aggregateThreshold: 0.9,
      results: [],
      regressions: [],
      improvements: [],
      neutrals: [],
      aggregateScores: {},
      formatted: '',
      timestamp: '2026-03-21T00:00:00.000Z',
      durationMs: 10,
    };
    expect(report.summary.passed).toBe(true);
    expect(report.metrics).toContain('jaccard');
    expect(report.aggregateThreshold).toBe(0.9);
  });
});

// ── RegressionReport extends BatchReport ─────────────────────────────────────

describe('RegressionReport', () => {
  it('extends BatchReport with additional fields', () => {
    const report: RegressionReport = {
      summary: {
        total: 2,
        neutral: 2,
        improvements: 0,
        regressions: 0,
        passRate: 1.0,
        passed: true,
      },
      metrics: ['semantic'],
      thresholds: { semantic: 0.85 },
      aggregateThreshold: 0.9,
      results: [],
      regressions: [],
      improvements: [],
      neutrals: [],
      aggregateScores: {},
      formatted: '',
      timestamp: '2026-03-21T00:00:00.000Z',
      durationMs: 500,
      baselinePrompt: 'Answer concisely:\n',
      candidatePrompt: 'Answer in one sentence:\n',
      llmCalls: 4,
      estimatedTokens: 1200,
    };
    expect(report.baselinePrompt).toBe('Answer concisely:\n');
    expect(report.candidatePrompt).toBe('Answer in one sentence:\n');
    expect(report.llmCalls).toBe(4);
    expect(report.estimatedTokens).toBe(1200);
  });

  it('has regressions, improvements, and neutrals arrays (via BatchReport)', () => {
    const r: RegressionReport = {
      summary: { total: 3, neutral: 2, improvements: 1, regressions: 0, passRate: 1.0, passed: true },
      metrics: ['jaccard'],
      thresholds: {},
      aggregateThreshold: 0.9,
      results: [],
      regressions: [],
      improvements: [],
      neutrals: [],
      aggregateScores: {},
      formatted: '',
      timestamp: '',
      durationMs: 0,
      baselinePrompt: 'v1',
      candidatePrompt: 'v2',
      llmCalls: 6,
      estimatedTokens: 0,
    };
    expect(Array.isArray(r.regressions)).toBe(true);
    expect(Array.isArray(r.improvements)).toBe(true);
    expect(Array.isArray(r.neutrals)).toBe(true);
  });
});

// ── CompareOptions ────────────────────────────────────────────────────────────

describe('CompareOptions', () => {
  it('is entirely optional', () => {
    const empty: CompareOptions = {};
    accepts<CompareOptions>(empty);
    expect(empty).toBeDefined();
  });

  it('accepts all known fields', () => {
    const opts: CompareOptions = {
      metric: 'jaccard',
      metrics: ['jaccard', 'semantic'],
      thresholds: { jaccard: 0.6, semantic: 0.85 },
      embedFn: async (_t: string) => [0.1],
      customMetricFn: (_b: string, _c: string) => ({ score: 0.9 }),
      structural: { allowExtraKeys: true, allowMissingKeys: false, checkArrayLength: true },
      contains: { phrases: ['Paris'], caseSensitive: false },
      jaccard: { caseSensitive: false, removeStopwords: true },
      bleu: { maxN: 4, weights: [0.25, 0.25, 0.25, 0.25] },
      exact: { trim: true, normalizeWhitespace: false, caseSensitive: true },
      groundTruth: 'Paris is the capital of France.',
    };
    expect(opts.metric).toBe('jaccard');
    expect(opts.metrics).toHaveLength(2);
    expect(opts.structural?.allowExtraKeys).toBe(true);
    expect(opts.contains?.phrases).toContain('Paris');
    expect(opts.bleu?.maxN).toBe(4);
  });
});

// ── BatchOptions extends CompareOptions ──────────────────────────────────────

describe('BatchOptions', () => {
  it('inherits all CompareOptions fields', () => {
    const opts: BatchOptions = {
      metric: 'rouge-l',
      thresholds: { 'rouge-l': 0.7 },
    };
    accepts<CompareOptions>(opts); // BatchOptions is assignable to CompareOptions
    expect(opts.metric).toBe('rouge-l');
  });

  it('adds concurrency, aggregateThreshold, format, classificationMode, onProgress', () => {
    const opts: BatchOptions = {
      aggregateThreshold: 0.95,
      classificationMode: 'any',
      compositeWeights: { jaccard: 0.5, semantic: 0.5 },
      compositeThreshold: 0.75,
      format: 'markdown',
      concurrency: 5,
      onProgress: (_completed: number, _total: number) => {},
    };
    expect(opts.aggregateThreshold).toBe(0.95);
    expect(opts.concurrency).toBe(5);
    expect(opts.format).toBe('markdown');
  });

  it('rejects unknown format values at compile time', () => {
    // @ts-expect-error — 'yaml' is not a valid format
    const _bad: BatchOptions = { format: 'yaml' };
    expect(_bad).toBeDefined();
  });
});

// ── RegressionOptions extends BatchOptions ────────────────────────────────────

describe('RegressionOptions', () => {
  it('extends BatchOptions and adds composePrompt and llmConcurrency', () => {
    const opts: RegressionOptions = {
      concurrency: 10,
      llmConcurrency: 3,
      composePrompt: (prompt: string, input: string) => `${prompt}\n${input}`,
    };
    accepts<BatchOptions>(opts); // RegressionOptions assignable to BatchOptions
    expect(opts.llmConcurrency).toBe(3);
    expect(opts.composePrompt?.('sys', 'user')).toBe('sys\nuser');
  });
});

// ── RegressionConfig ──────────────────────────────────────────────────────────

describe('RegressionConfig', () => {
  it('is entirely optional', () => {
    const empty: RegressionConfig = {};
    accepts<RegressionConfig>(empty);
    expect(empty).toBeDefined();
  });

  it('accepts all fields', () => {
    const config: RegressionConfig = {
      metrics: ['semantic', 'jaccard'],
      thresholds: { semantic: 0.85, jaccard: 0.6 },
      aggregateThreshold: 0.95,
      classificationMode: 'any',
      format: 'terminal',
      embedFn: async (_t: string) => [0.1, 0.2],
      customMetricFn: (_b: string, _c: string) => ({ score: 0.8 }),
      compositeWeights: { semantic: 0.7, jaccard: 0.3 },
      compositeThreshold: 0.8,
    };
    expect(config.metrics).toContain('semantic');
    expect(config.aggregateThreshold).toBe(0.95);
  });
});

// ── RegressionTester interface ────────────────────────────────────────────────

describe('RegressionTester', () => {
  it('can be mock-implemented', () => {
    const mockResult: ComparisonResult = {
      testId: 't1',
      baseline: 'a',
      candidate: 'b',
      scores: { jaccard: 0.5 },
      primaryScore: 0.5,
      classification: 'neutral',
      diff: '',
      durationMs: 1,
      metricResults: { jaccard: { score: 0.5, threshold: 0.6, passed: false } },
    };

    const mockReport: BatchReport = {
      summary: { total: 1, neutral: 1, improvements: 0, regressions: 0, passRate: 1.0, passed: true },
      metrics: ['jaccard'],
      thresholds: { jaccard: 0.6 },
      aggregateThreshold: 0.9,
      results: [mockResult],
      regressions: [],
      improvements: [],
      neutrals: [mockResult],
      aggregateScores: {},
      formatted: '',
      timestamp: '2026-03-21T00:00:00.000Z',
      durationMs: 2,
    };

    const mockRegressionReport: RegressionReport = {
      ...mockReport,
      baselinePrompt: 'v1',
      candidatePrompt: 'v2',
      llmCalls: 2,
      estimatedTokens: 100,
    };

    const tester: RegressionTester = {
      compare: async (_b: string, _c: string, _opts?: CompareOptions) => mockResult,
      compareBatch: async (_cases: TestCase[], _opts?: BatchOptions) => mockReport,
      runRegression: async (
        _inputs: TestInput[],
        _bp: string,
        _cp: string,
        _fn: LlmFn,
        _opts?: RegressionOptions,
      ) => mockRegressionReport,
    };

    accepts<RegressionTester>(tester);
    expect(typeof tester.compare).toBe('function');
    expect(typeof tester.compareBatch).toBe('function');
    expect(typeof tester.runRegression).toBe('function');
  });
});

// ── MetricThresholds and MetricScores ─────────────────────────────────────────

describe('MetricThresholds', () => {
  it('is a partial record of MetricId to number', () => {
    const t1: MetricThresholds = {};
    const t2: MetricThresholds = { jaccard: 0.6, semantic: 0.85 };
    const t3: MetricThresholds = { 'rouge-l': 0.7, bleu: 0.5, exact: 1.0 };
    expect(Object.keys(t1)).toHaveLength(0);
    expect(t2.jaccard).toBe(0.6);
    expect(t3['rouge-l']).toBe(0.7);
  });

  it('rejects unknown metric keys at compile time', () => {
    // @ts-expect-error — 'unknown-metric' is not a valid MetricId key
    const _bad: MetricThresholds = { 'unknown-metric': 0.5 };
    expect(_bad).toBeDefined();
  });
});

describe('MetricScores', () => {
  it('is a partial record of MetricId to number', () => {
    const scores: MetricScores = { jaccard: 0.857, semantic: 0.97, 'rouge-l': 0.88 };
    expect(scores.jaccard).toBe(0.857);
    expect(scores.semantic).toBe(0.97);
    expect(scores['rouge-l']).toBe(0.88);
  });
});

// ── BaselineEntry ─────────────────────────────────────────────────────────────

describe('BaselineEntry', () => {
  it('requires id and output', () => {
    const entry: BaselineEntry = { id: 'capital', output: 'Paris is the capital of France.' };
    expect(entry.id).toBe('capital');
    expect(entry.output).toBe('Paris is the capital of France.');
  });

  it('allows optional input and metadata', () => {
    const full: BaselineEntry = {
      id: 'q1',
      output: 'Paris.',
      input: 'What is the capital of France?',
      metadata: { model: 'gpt-4o-mini' },
    };
    expect(full.input).toBe('What is the capital of France?');
    expect(full.metadata?.model).toBe('gpt-4o-mini');
  });

  it('rejects missing id at compile time', () => {
    // @ts-expect-error — id is required
    const _bad: BaselineEntry = { output: 'no id' };
    expect(_bad).toBeDefined();
  });

  it('rejects missing output at compile time', () => {
    // @ts-expect-error — output is required
    const _bad: BaselineEntry = { id: 'no-output' };
    expect(_bad).toBeDefined();
  });
});

// ── BaselineFile ──────────────────────────────────────────────────────────────

describe('BaselineFile', () => {
  it('requires __meta and entries', () => {
    const file: BaselineFile = {
      __meta: {
        version: 1,
        createdAt: '2026-03-21T00:00:00.000Z',
      },
      entries: [{ id: 'capital', output: 'Paris is the capital of France.' }],
    };
    expect(file.__meta.version).toBe(1);
    expect(file.entries).toHaveLength(1);
  });

  it('allows optional promptVersion and model in __meta', () => {
    const file: BaselineFile = {
      __meta: {
        version: 1,
        createdAt: '2026-03-21T00:00:00.000Z',
        promptVersion: 'v1.2.0',
        model: 'gpt-4o-mini',
      },
      entries: [],
    };
    expect(file.__meta.promptVersion).toBe('v1.2.0');
    expect(file.__meta.model).toBe('gpt-4o-mini');
  });
});

// ── SaveBaselineOptions ───────────────────────────────────────────────────────

describe('SaveBaselineOptions', () => {
  it('is entirely optional', () => {
    const empty: SaveBaselineOptions = {};
    accepts<SaveBaselineOptions>(empty);
    expect(empty).toBeDefined();
  });

  it('accepts promptVersion and model', () => {
    const opts: SaveBaselineOptions = {
      promptVersion: 'v1.2.0',
      model: 'gpt-4o-mini',
    };
    expect(opts.promptVersion).toBe('v1.2.0');
    expect(opts.model).toBe('gpt-4o-mini');
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('MetricScores allows empty object (no metrics scored)', () => {
    const scores: MetricScores = {};
    expect(Object.keys(scores)).toHaveLength(0);
  });

  it('ComparisonResult.metricResults can contain results for multiple metrics', () => {
    const result: ComparisonResult = {
      testId: 'multi',
      baseline: 'Paris is the capital of France.',
      candidate: 'The capital of France is Paris.',
      scores: { jaccard: 0.857, semantic: 0.97, 'rouge-l': 0.88 },
      primaryScore: 0.97,
      classification: 'neutral',
      diff: '',
      durationMs: 150,
      metricResults: {
        jaccard: { score: 0.857, threshold: 0.6, passed: true },
        semantic: { score: 0.97, threshold: 0.85, passed: true },
        'rouge-l': { score: 0.88, threshold: 0.7, passed: true },
      },
    };
    expect(Object.keys(result.metricResults)).toHaveLength(3);
    expect(result.metricResults['rouge-l'].passed).toBe(true);
  });

  it('BatchReport.aggregateScores maps metric names to MetricStats', () => {
    const stats: MetricStats = { mean: 0.82, median: 0.86, min: 0.41, max: 1.0, stddev: 0.16, passRate: 0.9 };
    const report: BatchReport = {
      summary: { total: 10, neutral: 9, improvements: 0, regressions: 1, passRate: 0.9, passed: true },
      metrics: ['jaccard'],
      thresholds: { jaccard: 0.6 },
      aggregateThreshold: 0.9,
      results: [],
      regressions: [],
      improvements: [],
      neutrals: [],
      aggregateScores: { jaccard: stats },
      formatted: '',
      timestamp: '2026-03-21T00:00:00.000Z',
      durationMs: 245,
    };
    expect(report.aggregateScores['jaccard'].mean).toBe(0.82);
  });

  it('RegressionOptions.composePrompt composes prompts correctly', () => {
    const opts: RegressionOptions = {
      composePrompt: (prompt: string, input: string) => `${prompt}\nUser: ${input}`,
    };
    const composed = opts.composePrompt?.('Be helpful.', 'What is 2+2?');
    expect(composed).toBe('Be helpful.\nUser: What is 2+2?');
  });

  it('BatchOptions.onProgress callback signature is (completed, total) => void', () => {
    const calls: [number, number][] = [];
    const opts: BatchOptions = {
      onProgress: (completed: number, total: number) => {
        calls.push([completed, total]);
      },
    };
    opts.onProgress?.(1, 10);
    opts.onProgress?.(10, 10);
    expect(calls).toEqual([[1, 10], [10, 10]]);
  });
});
