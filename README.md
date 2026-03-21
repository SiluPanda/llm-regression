# llm-regression

Semantic regression testing for prompt versions. Compare LLM outputs across prompt changes using multiple similarity metrics, detect regressions before they reach production.

## Installation

```bash
npm install llm-regression
```

## Quick Start

```typescript
import { compare, compareBatch, createRegression } from 'llm-regression';

// Single-pair comparison
const result = await compare(
  'Paris is the capital of France.',
  'The capital of France is Paris.',
  { metric: 'jaccard', thresholds: { jaccard: 0.6 } }
);
console.log(result.classification); // 'neutral' | 'regression' | 'improvement'
console.log(result.primaryScore);   // e.g. 0.857

// Batch comparison
const testCases = [
  { id: 'q1', baseline: 'Paris is the capital.', candidate: 'The capital is Paris.' },
  { id: 'q2', baseline: '2 + 2 = 4.', candidate: 'The answer is 4.' },
];
const report = await compareBatch(testCases, {
  metrics: ['jaccard', 'rouge-l'],
  aggregateThreshold: 0.90,
});
console.log(report.summary.passed);    // true / false
console.log(report.summary.passRate);  // e.g. 0.5

// Pre-configured tester
const tester = createRegression({
  metrics: ['jaccard', 'rouge-l'],
  thresholds: { jaccard: 0.6, 'rouge-l': 0.7 },
  aggregateThreshold: 0.90,
});
const batchReport = await tester.compareBatch(testCases);
```

## API Reference

### `compare(baseline, candidate, options?)`

Compare a single baseline/candidate pair. Returns a `ComparisonResult`.

```typescript
const result = await compare(baseline, candidate, {
  metric: 'jaccard',           // single metric
  metrics: ['jaccard', 'bleu'], // or multiple metrics (overrides metric)
  thresholds: { jaccard: 0.6 },
  jaccard: { removeStopwords: true },
  exact: { trim: true, normalizeWhitespace: true, caseSensitive: false },
  bleu: { maxN: 4, weights: [0.25, 0.25, 0.25, 0.25] },
  contains: { phrases: ['Paris', 'France'] },
  structural: { allowExtraKeys: true },
  embedFn: async (text) => yourEmbeddingFn(text), // required for 'semantic'
  customMetricFn: (b, c) => ({ score: 0.9 }),      // required for 'custom'
});
```

Default metrics when none are specified: `['exact', 'jaccard', 'rouge-l']`.

### `compareBatch(testCases, options?)`

Compare a batch of test cases. Returns a `BatchReport` with aggregate statistics.

```typescript
const report = await compareBatch(testCases, {
  metrics: ['jaccard', 'rouge-l'],
  thresholds: { jaccard: 0.6, 'rouge-l': 0.7 },
  aggregateThreshold: 0.90,  // fraction of passing cases required
  concurrency: 4,             // parallel comparisons (default: 4)
  onProgress: (done, total) => console.log(`${done}/${total}`),
});
```

### `createRegression(config)`

Factory for pre-configured regression tester instances. Returns a `RegressionTester`.

```typescript
const tester = createRegression({
  metrics: ['jaccard'],
  thresholds: { jaccard: 0.6 },
  aggregateThreshold: 0.90,
});
await tester.compare(baseline, candidate);
await tester.compareBatch(testCases);
// tester.runRegression() — requires LLM calls, not yet implemented
```

### `saveBaseline(entries, filePath, options?)`

Save baseline outputs to a JSON file.

```typescript
import { saveBaseline } from 'llm-regression';

await saveBaseline(
  [{ id: 'q1', output: 'Paris is the capital of France.', input: 'What is the capital?' }],
  './baselines/v1.json',
  { promptVersion: 'v1.0.0', model: 'gpt-4o-mini' }
);
```

### `loadBaseline(filePath)`

Load baseline outputs from a JSON file.

```typescript
import { loadBaseline } from 'llm-regression';

const baseline = await loadBaseline('./baselines/v1.json');
console.log(baseline.__meta.promptVersion); // 'v1.0.0'
console.log(baseline.entries[0].output);
```

## Metric Functions

All metric functions are also exported individually:

```typescript
import {
  exactMatch,
  jaccardSimilarity,
  rougeL,
  bleuScore,
  containsScore,
  structuralSimilarity,
  computeMetric,
} from 'llm-regression';
```

### `exactMatch(baseline, candidate, options?)`

Binary match (1.0 or 0.0) after optional normalization.

Options: `{ trim?: boolean, normalizeWhitespace?: boolean, caseSensitive?: boolean }`
Defaults: `trim=true, normalizeWhitespace=true, caseSensitive=false`

### `jaccardSimilarity(baseline, candidate, options?)`

Token set intersection over union. Range: 0.0 – 1.0.

Options: `{ caseSensitive?: boolean, removeStopwords?: boolean }`

### `rougeL(baseline, candidate)`

Longest Common Subsequence F1 score. Range: 0.0 – 1.0.

### `bleuScore(baseline, candidate, options?)`

Modified n-gram precision with brevity penalty. Range: 0.0 – 1.0.

Options: `{ maxN?: number, weights?: number[] }`
Defaults: `maxN=4, weights=[0.25, 0.25, 0.25, 0.25]`

### `containsScore(baseline, candidate, options?)`

If `phrases` provided: fraction of phrases found in candidate.
Otherwise: 1.0 if baseline is contained in candidate, 0.0 otherwise.

Options: `{ phrases?: string[], caseSensitive?: boolean }`

### `structuralSimilarity(baseline, candidate, options?)`

JSON structure comparison. Parses both strings as JSON and compares key/type structure. Returns 0.0 if either string is not valid JSON.

Options: `{ allowExtraKeys?: boolean, allowMissingKeys?: boolean, checkArrayLength?: boolean }`

### `computeMetric(id, baseline, candidate, options?)`

Dispatches to the correct metric function by `MetricId`. Returns `NaN` for `'semantic'` (requires `embedFn`) and `'custom'` (requires `customMetricFn`) — use `compare()` for those.

## Supported Metrics

| Metric | ID | Description | Default Threshold |
|---|---|---|---|
| Exact Match | `exact` | Binary match after optional normalization | 1.0 |
| Jaccard Similarity | `jaccard` | Token set intersection over union | 0.60 |
| ROUGE-L | `rouge-l` | Longest common subsequence F1 score | 0.70 |
| BLEU | `bleu` | N-gram precision with brevity penalty | 0.50 |
| Semantic Similarity | `semantic` | Cosine similarity of embeddings (requires `embedFn`) | 0.85 |
| Contains | `contains` | Phrase/sentence containment check | 1.0 |
| Structural | `structural` | JSON structure comparison | 1.0 |
| Custom | `custom` | User-provided scoring function (requires `customMetricFn`) | 0.70 |

## Classification

Results are classified as:

- **`neutral`** — primary score is at or above the threshold
- **`regression`** — primary score is below the threshold
- **`improvement`** — reserved for future use with ground-truth comparison

## Available Types

All types are exported:

### Input Types
- **`TestCase`** — A test case with pre-generated baseline and candidate outputs.
- **`TestInput`** — A test input for the end-to-end regression pipeline.

### Metric Types
- **`MetricId`** — Union of supported metric identifiers.
- **`MetricThresholds`** — Per-metric threshold configuration.
- **`MetricScores`** — Scores from all requested metrics for one comparison.
- **`EmbedFn`** — User-provided embedding function signature.
- **`LlmFn`** — User-provided LLM function signature.
- **`CustomMetricFn`** — User-provided scoring function for custom metrics.
- **`CustomMetricResult`** — Return type for custom metric functions.

### Classification Types
- **`Classification`** — `'regression' | 'improvement' | 'neutral'`
- **`ClassificationMode`** — `'any' | 'all'` for multi-metric aggregation.

### Result Types
- **`ComparisonResult`** — Result of comparing one baseline/candidate pair.
- **`MetricStats`** — Aggregate statistics for one metric across test cases.
- **`BatchSummary`** — Summary counts and pass rate for a batch.
- **`BatchReport`** — Full result of a batch comparison.
- **`RegressionReport`** — Extends `BatchReport` with prompt and LLM call metadata.

### Options Types
- **`CompareOptions`** — Options for single-pair comparison.
- **`BatchOptions`** — Options for batch comparison (extends `CompareOptions`).
- **`RegressionOptions`** — Options for end-to-end regression testing (extends `BatchOptions`).
- **`RegressionConfig`** — Configuration for the `createRegression` factory.
- **`RegressionTester`** — Interface for pre-configured regression tester instances.

### Baseline Types
- **`BaselineEntry`** — A single entry in a baseline file.
- **`BaselineFile`** — Structure of a saved baseline JSON file.
- **`SaveBaselineOptions`** — Options for saving baselines.

## CLI

```bash
# Compare two strings (planned)
llm-regression compare --baseline "Paris is the capital." --candidate "The capital is Paris." --metric jaccard

# Run batch comparison from config (planned)
llm-regression run --config regression.json --format terminal

# Manage baselines (planned)
llm-regression baseline show ./baselines/v1.json
llm-regression baseline validate ./baselines/v1.json
```

## License

MIT
