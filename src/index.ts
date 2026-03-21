// llm-regression - Semantic regression testing for prompt versions

export type {
  MetricId,
  MetricThresholds,
  MetricScores,
  EmbedFn,
  LlmFn,
  CustomMetricFn,
  CustomMetricResult,
  Classification,
  ClassificationMode,
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
} from './types';

export { compare, compareBatch } from './compare';
export { createRegression } from './regression';
export { saveBaseline, loadBaseline } from './baseline';
export {
  exactMatch,
  jaccardSimilarity,
  rougeL,
  bleuScore,
  containsScore,
  structuralSimilarity,
  computeMetric,
} from './metrics/index';
