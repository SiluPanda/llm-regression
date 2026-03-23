import type {
  MetricId,
  MetricThresholds,
  MetricScores,
  CompareOptions,
  ComparisonResult,
  TestCase,
  BatchOptions,
  BatchReport,
  MetricStats,
  Classification,
} from './types';
import { computeMetric } from './metrics/index';
import { computeDiff } from './diff';

// ── Default thresholds ────────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS: Required<MetricThresholds> = {
  exact: 1.0,
  jaccard: 0.60,
  'rouge-l': 0.70,
  bleu: 0.50,
  contains: 1.0,
  structural: 1.0,
  semantic: 0.85,
  custom: 0.70,
};

const DEFAULT_METRICS: MetricId[] = ['exact', 'jaccard', 'rouge-l'];

// ── Helpers ───────────────────────────────────────────────────────────────────

let _idCounter = 0;
function nextId(): string {
  return `test-${++_idCounter}`;
}

function resolveMetrics(options?: CompareOptions): MetricId[] {
  if (options?.metrics && options.metrics.length > 0) return options.metrics;
  if (options?.metric) return [options.metric];
  return DEFAULT_METRICS;
}

function resolveThresholds(
  metrics: MetricId[],
  optionThresholds?: MetricThresholds,
  caseThresholds?: MetricThresholds,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const m of metrics) {
    result[m] =
      caseThresholds?.[m] ??
      optionThresholds?.[m] ??
      DEFAULT_THRESHOLDS[m] ??
      0.5;
  }
  return result;
}

async function computeMetricAsync(
  id: MetricId,
  baseline: string,
  candidate: string,
  options?: CompareOptions,
): Promise<number> {
  if (id === 'semantic') {
    if (!options?.embedFn) return NaN;
    const [vecA, vecB] = await Promise.all([
      options.embedFn(baseline),
      options.embedFn(candidate),
    ]);
    // Cosine similarity
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  if (id === 'custom') {
    if (!options?.customMetricFn) return NaN;
    const result = await options.customMetricFn(baseline, candidate);
    return result.score;
  }

  return computeMetric(id, baseline, candidate, options);
}

function classifyScore(
  primaryScore: number,
  metrics: MetricId[],
  scores: MetricScores,
  thresholds: Record<string, number>,
): Classification {
  if (isNaN(primaryScore)) return 'neutral';

  // Use the primary score against the primary metric's threshold
  const primaryMetric = metrics[0];
  const primaryThreshold = thresholds[primaryMetric] ?? 0.5;

  if (primaryScore >= primaryThreshold) return 'neutral';

  // Below threshold — check if this is an improvement or regression
  // We treat it simply: below threshold is a regression
  // (improvement logic would require groundTruth comparison, which is left to caller)
  return 'regression';
}

function computeMetricStats(scores: number[], threshold: number): MetricStats {
  if (scores.length === 0) {
    return { mean: 0, median: 0, min: 0, max: 0, stddev: 0, passRate: 0 };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  const median =
    scores.length % 2 === 0
      ? (sorted[scores.length / 2 - 1] + sorted[scores.length / 2]) / 2
      : sorted[Math.floor(scores.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
  const stddev = Math.sqrt(variance);
  const passRate = scores.filter((s) => s >= threshold).length / scores.length;

  return { mean, median, min, max, stddev, passRate };
}

// ── compare ───────────────────────────────────────────────────────────────────

export async function compare(
  baseline: string,
  candidate: string,
  options?: CompareOptions,
  testCase?: TestCase,
): Promise<ComparisonResult> {
  const start = Date.now();
  const testId = testCase?.id ?? nextId();
  const metrics = resolveMetrics(options);
  const thresholds = resolveThresholds(metrics, options?.thresholds, testCase?.thresholds);

  const scores: MetricScores = {};
  const metricResults: ComparisonResult['metricResults'] = {};

  for (const m of metrics) {
    const score = await computeMetricAsync(m, baseline, candidate, options);
    scores[m] = score;
    const threshold = thresholds[m];
    metricResults[m] = {
      score,
      threshold,
      passed: !isNaN(score) && score >= threshold,
    };
  }

  // Primary score: average of all non-NaN scores, or first metric's score
  const validScores = metrics
    .map((m) => scores[m])
    .filter((s): s is number => s !== undefined && !isNaN(s));

  const primaryScore =
    validScores.length > 0
      ? validScores.reduce((a, b) => a + b, 0) / validScores.length
      : NaN;

  const classification = classifyScore(primaryScore, metrics, scores, thresholds);
  const diff = computeDiff(baseline, candidate);
  const durationMs = Date.now() - start;

  return {
    testId,
    baseline,
    candidate,
    input: testCase?.input,
    scores,
    primaryScore,
    classification,
    diff,
    durationMs,
    metricResults,
  };
}

// ── compareBatch ──────────────────────────────────────────────────────────────

export async function compareBatch(
  testCases: TestCase[],
  options?: BatchOptions,
): Promise<BatchReport> {
  const start = Date.now();
  const concurrency = options?.concurrency ?? 4;
  const aggregateThreshold = options?.aggregateThreshold ?? 0.90;
  const metrics = resolveMetrics(options);
  const thresholds = resolveThresholds(metrics, options?.thresholds);

  const results: ComparisonResult[] = [];
  let completed = 0;

  // Process in batches of `concurrency`
  for (let i = 0; i < testCases.length; i += concurrency) {
    const batch = testCases.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((tc) => compare(tc.baseline, tc.candidate, options, tc)),
    );
    results.push(...batchResults);
    completed += batchResults.length;
    options?.onProgress?.(completed, testCases.length);
  }

  const regressions = results.filter((r) => r.classification === 'regression');
  const improvements = results.filter((r) => r.classification === 'improvement');
  const neutrals = results.filter((r) => r.classification === 'neutral');

  const total = results.length;
  const passRate = total > 0 ? (neutrals.length + improvements.length) / total : 1;
  const passed = passRate >= aggregateThreshold;

  const summary = {
    total,
    neutral: neutrals.length,
    improvements: improvements.length,
    regressions: regressions.length,
    passRate,
    passed,
  };

  // Aggregate stats per metric
  const aggregateScores: Record<string, MetricStats> = {};
  for (const m of metrics) {
    const metricScores = results
      .map((r) => r.scores[m])
      .filter((s): s is number => s !== undefined && !isNaN(s));
    aggregateScores[m] = computeMetricStats(metricScores, thresholds[m] ?? 0.5);
  }

  const durationMs = Date.now() - start;

  return {
    summary,
    metrics,
    thresholds,
    aggregateThreshold,
    results,
    regressions,
    improvements,
    neutrals,
    aggregateScores,
    formatted: '',
    timestamp: new Date().toISOString(),
    durationMs,
  };
}
