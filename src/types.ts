// ── Input Types ──────────────────────────────────────────────────────

/** A single test case with pre-generated baseline and candidate outputs. */
export interface TestCase {
  /** Optional unique identifier for tracking in reports. */
  id?: string;

  /** The input that produced these outputs. Stored for context, not used in comparison. */
  input?: string;

  /** The baseline (reference) output. */
  baseline: string;

  /** The candidate (new) output. */
  candidate: string;

  /** Arbitrary metadata for grouping, filtering, or annotation. */
  metadata?: Record<string, unknown>;

  /** Per-test-case threshold overrides. */
  thresholds?: MetricThresholds;
}

/** A test input for the end-to-end regression pipeline. */
export interface TestInput {
  /** Optional unique identifier. */
  id?: string;

  /** The input text to send to both prompts. */
  input: string;

  /** Arbitrary metadata. */
  metadata?: Record<string, unknown>;

  /** Per-input threshold overrides. */
  thresholds?: MetricThresholds;

  /**
   * Optional ground truth output for improvement detection.
   * If provided, both baseline and candidate are compared against this
   * reference to determine which is closer to the ideal output.
   */
  groundTruth?: string;
}

// ── Metric Types ─────────────────────────────────────────────────────

/** Identifiers for built-in similarity metrics. */
export type MetricId =
  | 'semantic'
  | 'jaccard'
  | 'rouge-l'
  | 'bleu'
  | 'exact'
  | 'contains'
  | 'structural'
  | 'custom';

/** Per-metric threshold configuration. */
export type MetricThresholds = Partial<Record<MetricId, number>>;

/** Scores from all requested metrics for one comparison. */
export type MetricScores = Partial<Record<MetricId, number>>;

/** User-provided embedding function for semantic similarity. */
export type EmbedFn = (text: string) => Promise<number[]>;

/** User-provided LLM function for generating outputs. */
export type LlmFn = (prompt: string) => Promise<string>;

/** User-provided scoring function for custom metrics. */
export type CustomMetricFn = (
  baseline: string,
  candidate: string,
) => CustomMetricResult | Promise<CustomMetricResult>;

export interface CustomMetricResult {
  /** Similarity score in [0, 1]. */
  score: number;

  /** Optional human-readable explanation. */
  details?: string;
}

// ── Comparison Classification ────────────────────────────────────────

/** How a comparison is classified. */
export type Classification = 'regression' | 'improvement' | 'neutral';

/** How multi-metric classification aggregates. */
export type ClassificationMode = 'any' | 'all';

// ── Result Types ─────────────────────────────────────────────────────

/** Result of comparing one baseline/candidate pair. */
export interface ComparisonResult {
  /** Test case identifier (from TestCase.id or auto-generated). */
  testId: string;

  /** The baseline output. */
  baseline: string;

  /** The candidate output. */
  candidate: string;

  /** The input that produced these outputs (if available). */
  input?: string;

  /** Similarity scores from all requested metrics. */
  scores: MetricScores;

  /** The primary score used for classification (first metric, or composite). */
  primaryScore: number;

  /** Classification based on scores vs. thresholds. */
  classification: Classification;

  /** Human-readable diff between baseline and candidate. */
  diff: string;

  /** Time taken for this comparison, in milliseconds. */
  durationMs: number;

  /** Per-metric pass/fail. */
  metricResults: Record<string, { score: number; threshold: number; passed: boolean }>;
}

/** Aggregate statistics for one metric across all test cases. */
export interface MetricStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  stddev: number;
  passRate: number;
}

/** Summary of a batch comparison. */
export interface BatchSummary {
  /** Total number of test cases. */
  total: number;

  /** Number classified as neutral. */
  neutral: number;

  /** Number classified as improvement. */
  improvements: number;

  /** Number classified as regression. */
  regressions: number;

  /** Fraction of test cases that passed (neutral + improvements) / total. */
  passRate: number;

  /** Whether the overall test passed (passRate >= aggregateThreshold). */
  passed: boolean;
}

/** Result of comparing a batch of test cases. */
export interface BatchReport {
  /** High-level summary. */
  summary: BatchSummary;

  /** Which metrics were used. */
  metrics: MetricId[];

  /** Thresholds used for each metric. */
  thresholds: MetricThresholds;

  /** Aggregate threshold for overall pass/fail. */
  aggregateThreshold: number;

  /** Per-test-case results. */
  results: ComparisonResult[];

  /** Test cases classified as regressions. */
  regressions: ComparisonResult[];

  /** Test cases classified as improvements. */
  improvements: ComparisonResult[];

  /** Test cases classified as neutral. */
  neutrals: ComparisonResult[];

  /** Aggregate statistics per metric. */
  aggregateScores: Record<string, MetricStats>;

  /** Formatted output in the requested format. */
  formatted: string;

  /** ISO 8601 timestamp. */
  timestamp: string;

  /** Total duration in milliseconds. */
  durationMs: number;
}

/** Result of a full regression test run (extends BatchReport). */
export interface RegressionReport extends BatchReport {
  /** The baseline prompt used. */
  baselinePrompt: string;

  /** The candidate prompt used. */
  candidatePrompt: string;

  /** Number of LLM calls made (baseline + candidate generations). */
  llmCalls: number;

  /** Estimated total tokens consumed. */
  estimatedTokens: number;
}

// ── Options Types ────────────────────────────────────────────────────

/** Options for single-pair comparison. */
export interface CompareOptions {
  /** Which metric to use. Default: 'jaccard'. */
  metric?: MetricId;

  /** Multiple metrics to compute simultaneously. Overrides `metric`. */
  metrics?: MetricId[];

  /** Per-metric thresholds. Default: metric-specific defaults. */
  thresholds?: MetricThresholds;

  /** Embedding function for semantic similarity. Required when metric is 'semantic'. */
  embedFn?: EmbedFn;

  /** Custom metric function. Required when metric is 'custom'. */
  customMetricFn?: CustomMetricFn;

  /** Configuration for structural metric. */
  structural?: {
    allowExtraKeys?: boolean;
    allowMissingKeys?: boolean;
    checkArrayLength?: boolean;
  };

  /** Configuration for contains metric. */
  contains?: {
    phrases?: string[];
    caseSensitive?: boolean;
  };

  /** Configuration for jaccard metric. */
  jaccard?: {
    caseSensitive?: boolean;
    removeStopwords?: boolean;
  };

  /** Configuration for BLEU metric. */
  bleu?: {
    maxN?: number;
    weights?: number[];
  };

  /** Configuration for exact metric. */
  exact?: {
    trim?: boolean;
    normalizeWhitespace?: boolean;
    caseSensitive?: boolean;
  };

  /** Ground truth reference for improvement detection. */
  groundTruth?: string;
}

/** Options for batch comparison. */
export interface BatchOptions extends CompareOptions {
  /** Minimum pass rate for overall pass. Default: 0.90. */
  aggregateThreshold?: number;

  /** How multi-metric classification works. Default: 'any'. */
  classificationMode?: ClassificationMode;

  /** Weights for composite scoring. If provided, metrics are combined into a single score. */
  compositeWeights?: Partial<Record<MetricId, number>>;

  /** Threshold for composite score. Used when compositeWeights is set. */
  compositeThreshold?: number;

  /** Output format. Default: 'terminal'. */
  format?: 'terminal' | 'json' | 'markdown' | 'html';

  /** Concurrency limit for comparisons. Default: 10. */
  concurrency?: number;

  /** Progress callback. Called after each comparison completes. */
  onProgress?: (completed: number, total: number) => void;
}

/** Options for end-to-end regression testing. */
export interface RegressionOptions extends BatchOptions {
  /**
   * Function that composes the final prompt from the prompt template and the input.
   * Default: `(prompt, input) => prompt + input`.
   */
  composePrompt?: (prompt: string, input: string) => string;

  /**
   * Concurrency limit for LLM calls. Default: 5.
   * Separate from comparison concurrency to control API rate limiting.
   */
  llmConcurrency?: number;
}

/** Configuration for createRegression factory. */
export interface RegressionConfig {
  /** Default metrics. Default: ['jaccard']. */
  metrics?: MetricId[];

  /** Default thresholds. */
  thresholds?: MetricThresholds;

  /** Default aggregate threshold. Default: 0.90. */
  aggregateThreshold?: number;

  /** Default classification mode. Default: 'any'. */
  classificationMode?: ClassificationMode;

  /** Default output format. Default: 'terminal'. */
  format?: 'terminal' | 'json' | 'markdown' | 'html';

  /** Embedding function. */
  embedFn?: EmbedFn;

  /** Custom metric function. */
  customMetricFn?: CustomMetricFn;

  /** Composite weights. */
  compositeWeights?: Partial<Record<MetricId, number>>;

  /** Composite threshold. */
  compositeThreshold?: number;
}

/** Pre-configured regression tester instance. */
export interface RegressionTester {
  compare(baseline: string, candidate: string, options?: CompareOptions): Promise<ComparisonResult>;
  compareBatch(testCases: TestCase[], options?: BatchOptions): Promise<BatchReport>;
  runRegression(
    testInputs: TestInput[],
    baselinePrompt: string,
    candidatePrompt: string,
    llmFn: LlmFn,
    options?: RegressionOptions,
  ): Promise<RegressionReport>;
}

// ── Baseline Management Types ────────────────────────────────────────

/** A single entry in a baseline file. */
export interface BaselineEntry {
  /** Unique identifier for this entry. */
  id: string;

  /** The LLM output. */
  output: string;

  /** The input that produced this output. */
  input?: string;

  /** Arbitrary metadata. */
  metadata?: Record<string, unknown>;
}

/** The structure of a saved baseline JSON file. */
export interface BaselineFile {
  __meta: {
    version: number;
    createdAt: string;
    promptVersion?: string;
    model?: string;
  };
  entries: BaselineEntry[];
}

/** Options for saveBaseline. */
export interface SaveBaselineOptions {
  /** Prompt version identifier for traceability. */
  promptVersion?: string;

  /** Model name for traceability. */
  model?: string;
}
