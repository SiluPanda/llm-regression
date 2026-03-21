import type {
  RegressionConfig,
  RegressionTester,
  CompareOptions,
  ComparisonResult,
  TestCase,
  BatchOptions,
  BatchReport,
  TestInput,
  LlmFn,
  RegressionOptions,
  RegressionReport,
} from './types';
import { compare, compareBatch } from './compare';

export function createRegression(config: RegressionConfig): RegressionTester {
  function mergeCompareOptions(options?: CompareOptions): CompareOptions {
    const merged: CompareOptions = {
      embedFn: config.embedFn,
      customMetricFn: config.customMetricFn,
      ...options,
    };
    // Deep-merge thresholds so config defaults are not lost
    merged.thresholds = { ...config.thresholds, ...options?.thresholds };
    // Only apply config metrics if options doesn't specify any
    if (!options?.metrics && !options?.metric) {
      merged.metrics = config.metrics;
    }
    return merged;
  }

  function mergeBatchOptions(options?: BatchOptions): BatchOptions {
    return {
      ...mergeCompareOptions(options),
      aggregateThreshold: options?.aggregateThreshold ?? config.aggregateThreshold,
      classificationMode: options?.classificationMode ?? config.classificationMode,
      format: options?.format ?? config.format,
      compositeWeights: options?.compositeWeights ?? config.compositeWeights,
      compositeThreshold: options?.compositeThreshold ?? config.compositeThreshold,
    };
  }

  return {
    compare(
      baseline: string,
      candidate: string,
      options?: CompareOptions,
    ): Promise<ComparisonResult> {
      return compare(baseline, candidate, mergeCompareOptions(options));
    },

    compareBatch(testCases: TestCase[], options?: BatchOptions): Promise<BatchReport> {
      return compareBatch(testCases, mergeBatchOptions(options));
    },

    runRegression(
      _testInputs: TestInput[],
      _baselinePrompt: string,
      _candidatePrompt: string,
      _llmFn: LlmFn,
      _options?: RegressionOptions,
    ): Promise<RegressionReport> {
      throw new Error('not implemented');
    },
  };
}
