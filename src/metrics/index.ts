import type { MetricId, CompareOptions } from '../types';
import { exactMatch } from './exact';
import { jaccardSimilarity } from './jaccard';
import { rougeL } from './rouge-l';
import { bleuScore } from './bleu';
import { containsScore } from './contains';
import { structuralSimilarity } from './structural';

export { exactMatch } from './exact';
export { jaccardSimilarity } from './jaccard';
export { rougeL } from './rouge-l';
export { bleuScore } from './bleu';
export { containsScore } from './contains';
export { structuralSimilarity } from './structural';

export function computeMetric(
  id: MetricId,
  baseline: string,
  candidate: string,
  options?: CompareOptions,
): number {
  switch (id) {
    case 'exact':
      return exactMatch(baseline, candidate, options?.exact);

    case 'jaccard':
      return jaccardSimilarity(baseline, candidate, options?.jaccard);

    case 'rouge-l':
      return rougeL(baseline, candidate);

    case 'bleu':
      return bleuScore(baseline, candidate, options?.bleu);

    case 'contains':
      return containsScore(baseline, candidate, options?.contains);

    case 'structural':
      return structuralSimilarity(baseline, candidate, options?.structural);

    case 'semantic':
      // Requires embedFn — cannot compute synchronously here
      // Caller must handle semantic metric with embedFn separately
      return NaN;

    case 'custom':
      // Requires customMetricFn — cannot compute synchronously here
      // Caller must handle custom metric with customMetricFn separately
      return NaN;

    default: {
      const _exhaustive: never = id;
      void _exhaustive;
      return NaN;
    }
  }
}
