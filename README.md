# llm-regression

Semantic regression testing for prompt versions. Compare LLM outputs across prompt changes using multiple similarity metrics, detect regressions before they reach production.

## Installation

```bash
npm install llm-regression
```

## Quick Start

```typescript
import type {
  TestCase,
  CompareOptions,
  BatchOptions,
  ComparisonResult,
  BatchReport,
} from 'llm-regression';

// Single-pair comparison (planned API)
// const result: ComparisonResult = await compare(
//   'Paris is the capital of France.',
//   'The capital of France is Paris.',
//   { metric: 'jaccard', thresholds: { jaccard: 0.6 } }
// );

// Batch comparison (planned API)
// const testCases: TestCase[] = [
//   { id: 'q1', baseline: 'Paris is the capital.', candidate: 'The capital is Paris.' },
//   { id: 'q2', baseline: '2 + 2 = 4.', candidate: 'The answer is 4.' },
// ];
// const report: BatchReport = await compareBatch(testCases, {
//   metrics: ['jaccard', 'rouge-l'],
//   aggregateThreshold: 0.90,
// });

// End-to-end regression testing (planned API)
// const report = await runRegression(
//   [{ input: 'What is the capital of France?' }],
//   'Answer concisely:\n',
//   'Answer in one sentence:\n',
//   async (prompt) => callYourLLM(prompt),
//   { metrics: ['semantic'], embedFn: yourEmbedFn }
// );
```

## Available Exports

All types are exported and available for use today:

### Input Types

- **`TestCase`** -- A test case with pre-generated baseline and candidate outputs.
- **`TestInput`** -- A test input for the end-to-end regression pipeline.

### Metric Types

- **`MetricId`** -- Union of supported metric identifiers.
- **`MetricThresholds`** -- Per-metric threshold configuration.
- **`MetricScores`** -- Scores from all requested metrics for one comparison.
- **`EmbedFn`** -- User-provided embedding function signature.
- **`LlmFn`** -- User-provided LLM function signature.
- **`CustomMetricFn`** -- User-provided scoring function for custom metrics.
- **`CustomMetricResult`** -- Return type for custom metric functions.

### Classification Types

- **`Classification`** -- `'regression' | 'improvement' | 'neutral'`
- **`ClassificationMode`** -- `'any' | 'all'` for multi-metric aggregation.

### Result Types

- **`ComparisonResult`** -- Result of comparing one baseline/candidate pair.
- **`MetricStats`** -- Aggregate statistics for one metric across test cases.
- **`BatchSummary`** -- Summary counts and pass rate for a batch.
- **`BatchReport`** -- Full result of a batch comparison.
- **`RegressionReport`** -- Extends `BatchReport` with prompt and LLM call metadata.

### Options Types

- **`CompareOptions`** -- Options for single-pair comparison.
- **`BatchOptions`** -- Options for batch comparison (extends `CompareOptions`).
- **`RegressionOptions`** -- Options for end-to-end regression testing (extends `BatchOptions`).
- **`RegressionConfig`** -- Configuration for the `createRegression` factory.
- **`RegressionTester`** -- Interface for pre-configured regression tester instances.

### Baseline Types

- **`BaselineEntry`** -- A single entry in a baseline file.
- **`BaselineFile`** -- Structure of a saved baseline JSON file.
- **`SaveBaselineOptions`** -- Options for saving baselines.

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

## Planned API

The following functions will be available in upcoming releases:

- **`compare(baseline, candidate, options?)`** -- Compare two strings using one or more metrics.
- **`compareBatch(testCases, options?)`** -- Compare a batch of test cases with aggregate statistics.
- **`runRegression(inputs, baselinePrompt, candidatePrompt, llmFn, options?)`** -- End-to-end regression test with LLM generation.
- **`createRegression(config)`** -- Factory for pre-configured regression tester instances.
- **`saveBaseline(entries, path, options?)`** -- Save baseline outputs to a JSON file.
- **`loadBaseline(path)`** -- Load baseline outputs from a JSON file.

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
