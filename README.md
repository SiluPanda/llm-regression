# llm-regression

Semantic regression testing for LLM prompt versions. Compare outputs across prompt changes using pluggable similarity metrics, classify each change as a regression, improvement, or neutral, and enforce configurable pass/fail thresholds.

[![npm version](https://img.shields.io/npm/v/llm-regression.svg)](https://www.npmjs.com/package/llm-regression)
[![license](https://img.shields.io/npm/l/llm-regression.svg)](https://github.com/SiluPanda/llm-regression/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/llm-regression.svg)](https://nodejs.org)
[![types](https://img.shields.io/npm/types/llm-regression.svg)](https://www.npmjs.com/package/llm-regression)

---

## Description

When a prompt engineer modifies a prompt -- rewording instructions, adjusting few-shot examples, switching models -- the outputs change. Some changes are intentional improvements. Others are unintended regressions: the prompt that used to correctly answer "What is the capital of France?" with "Paris is the capital of France" now responds with a vague, indirect answer.

`llm-regression` provides a programmatic, typed comparison layer that detects these regressions. It compares baseline (known-good) outputs against candidate (new) outputs using multiple similarity metrics, classifies each comparison, aggregates results across test suites, and reports pass/fail outcomes suitable for CI pipelines.

The library operates at three levels:

1. **Pairwise comparison** -- compare two strings with configurable metrics.
2. **Batch comparison** -- compare an array of baseline/candidate pairs with aggregate statistics.
3. **Factory-configured tester** -- pre-configure metrics, thresholds, and options for reuse across test files.

Zero runtime dependencies for all lexical metrics. Semantic similarity requires a user-provided embedding function.

---

## Installation

```bash
npm install llm-regression
```

Requires Node.js >= 18.

---

## Quick Start

```typescript
import { compare, compareBatch, createRegression } from 'llm-regression';

// Single-pair comparison
const result = await compare(
  'Paris is the capital of France.',
  'The capital of France is Paris.',
  { metric: 'jaccard', thresholds: { jaccard: 0.6 } }
);
console.log(result.classification); // 'neutral'
console.log(result.primaryScore);   // 0.857...

// Batch comparison
const report = await compareBatch(
  [
    { id: 'q1', baseline: 'Paris is the capital.', candidate: 'The capital is Paris.' },
    { id: 'q2', baseline: '2 + 2 = 4.', candidate: 'The answer is 4.' },
  ],
  {
    metrics: ['jaccard', 'rouge-l'],
    aggregateThreshold: 0.90,
  }
);
console.log(report.summary.passed);   // true or false
console.log(report.summary.passRate); // e.g. 0.5

// Pre-configured tester
const tester = createRegression({
  metrics: ['jaccard', 'rouge-l'],
  thresholds: { jaccard: 0.6, 'rouge-l': 0.7 },
  aggregateThreshold: 0.90,
});
const batchReport = await tester.compareBatch([
  { id: 'q1', baseline: 'Paris is the capital.', candidate: 'The capital is Paris.' },
]);
```

---

## Features

- **Eight built-in similarity metrics** -- Exact match, Jaccard similarity, ROUGE-L, BLEU, semantic similarity, contains, structural (JSON), and custom user-provided scoring functions.
- **Multi-metric comparison** -- Run multiple metrics simultaneously on each pair and get a score vector per test case.
- **Three-level classification** -- Each comparison is classified as `regression`, `improvement`, or `neutral` based on configurable thresholds.
- **Batch processing with concurrency control** -- Compare arrays of test cases with configurable parallelism and progress callbacks.
- **Aggregate statistics** -- Per-metric mean, median, min, max, standard deviation, and pass rate across all test cases.
- **Configurable thresholds** -- Set thresholds at global, per-metric, and per-test-case levels, with a configurable aggregate pass rate.
- **Factory pattern** -- Pre-configure a `RegressionTester` instance with defaults for metrics, thresholds, and options.
- **Baseline management** -- Save and load baseline outputs as versioned JSON files with metadata.
- **Human-readable diffs** -- Word-level diff output showing added and removed tokens between baseline and candidate.
- **Zero runtime dependencies** -- All lexical metrics (Jaccard, ROUGE-L, BLEU, exact, contains, structural) are implemented with zero external dependencies.
- **Full TypeScript support** -- Complete type definitions for all exports, options, and result objects.

---

## API Reference

### `compare(baseline, candidate, options?, testCase?)`

Compare a single baseline/candidate string pair. Returns a `Promise<ComparisonResult>`.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `baseline` | `string` | The reference (known-good) output. |
| `candidate` | `string` | The new output to compare against the baseline. |
| `options` | `CompareOptions` | Optional. Metric selection, thresholds, and metric-specific configuration. |
| `testCase` | `TestCase` | Optional. Provides `id`, `input`, and per-case threshold overrides. |

**Returns:** `Promise<ComparisonResult>`

```typescript
const result = await compare(
  'Paris is the capital of France.',
  'The capital of France is Paris.',
  {
    metric: 'jaccard',
    thresholds: { jaccard: 0.6 },
  }
);

// result.testId         -- auto-generated or from testCase.id
// result.scores         -- { jaccard: 0.857 }
// result.primaryScore   -- average of all non-NaN metric scores
// result.classification -- 'neutral' | 'regression' | 'improvement'
// result.diff           -- human-readable token diff
// result.durationMs     -- time taken in milliseconds
// result.metricResults  -- { jaccard: { score: 0.857, threshold: 0.6, passed: true } }
```

When no metrics are specified, the defaults are `['exact', 'jaccard', 'rouge-l']`.

---

### `compareBatch(testCases, options?)`

Compare an array of test cases. Returns a `Promise<BatchReport>` with per-case results and aggregate statistics.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `testCases` | `TestCase[]` | Array of test cases, each with `baseline` and `candidate` strings. |
| `options` | `BatchOptions` | Optional. Extends `CompareOptions` with batch-specific settings. |

**Returns:** `Promise<BatchReport>`

```typescript
const report = await compareBatch(
  [
    { id: 'q1', baseline: 'Paris is the capital.', candidate: 'The capital is Paris.' },
    { id: 'q2', baseline: '2 + 2 = 4.', candidate: 'Completely wrong answer.' },
  ],
  {
    metrics: ['jaccard', 'rouge-l'],
    thresholds: { jaccard: 0.6, 'rouge-l': 0.7 },
    aggregateThreshold: 0.90,
    concurrency: 4,
    onProgress: (completed, total) => console.log(`${completed}/${total}`),
  }
);

// report.summary.total       -- 2
// report.summary.passed      -- true or false
// report.summary.passRate    -- (neutral + improvements) / total
// report.summary.regressions -- count of regressions
// report.regressions         -- array of ComparisonResult for regressions
// report.aggregateScores     -- { jaccard: { mean, median, min, max, stddev, passRate } }
```

**Batch-specific options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `aggregateThreshold` | `number` | `0.90` | Minimum pass rate for overall pass/fail. |
| `concurrency` | `number` | `4` | Maximum parallel comparisons. |
| `classificationMode` | `'any' \| 'all'` | `'any'` | How multi-metric classification aggregates. |
| `compositeWeights` | `Partial<Record<MetricId, number>>` | -- | Weights for composite scoring. |
| `compositeThreshold` | `number` | -- | Threshold for the composite score. |
| `format` | `'terminal' \| 'json' \| 'markdown' \| 'html'` | `'terminal'` | Output format for `formatted` field. |
| `onProgress` | `(completed: number, total: number) => void` | -- | Progress callback after each comparison. |

---

### `createRegression(config)`

Factory function that returns a pre-configured `RegressionTester` instance. Per-call options override instance defaults.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `config` | `RegressionConfig` | Default configuration for all methods on the returned instance. |

**Returns:** `RegressionTester`

```typescript
const tester = createRegression({
  metrics: ['jaccard', 'rouge-l'],
  thresholds: { jaccard: 0.6, 'rouge-l': 0.7 },
  aggregateThreshold: 0.90,
  classificationMode: 'any',
  format: 'terminal',
});

// Methods on the tester use instance defaults, overridable per call:
const result = await tester.compare('baseline text', 'candidate text');
const report = await tester.compareBatch(testCases);
const report2 = await tester.compareBatch(testCases, { aggregateThreshold: 0.95 });
```

**`RegressionConfig` fields:**

| Field | Type | Default | Description |
|---|---|---|---|
| `metrics` | `MetricId[]` | `['jaccard']` | Default metrics. |
| `thresholds` | `MetricThresholds` | -- | Default per-metric thresholds. |
| `aggregateThreshold` | `number` | `0.90` | Default aggregate pass rate threshold. |
| `classificationMode` | `ClassificationMode` | `'any'` | Default multi-metric classification mode. |
| `format` | `string` | `'terminal'` | Default output format. |
| `embedFn` | `EmbedFn` | -- | Embedding function for semantic metric. |
| `customMetricFn` | `CustomMetricFn` | -- | Custom scoring function. |
| `compositeWeights` | `Partial<Record<MetricId, number>>` | -- | Weights for composite scoring. |
| `compositeThreshold` | `number` | -- | Threshold for composite score. |

**`RegressionTester` methods:**

- `compare(baseline, candidate, options?)` -- returns `Promise<ComparisonResult>`
- `compareBatch(testCases, options?)` -- returns `Promise<BatchReport>`
- `runRegression(testInputs, baselinePrompt, candidatePrompt, llmFn, options?)` -- returns `Promise<RegressionReport>`

---

### `saveBaseline(entries, filePath, options?)`

Save baseline outputs to a JSON file with metadata.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `entries` | `BaselineEntry[]` | Array of baseline entries, each with `id` and `output`. |
| `filePath` | `string` | Path to write the JSON file. |
| `options` | `SaveBaselineOptions` | Optional. Metadata such as `promptVersion` and `model`. |

**Returns:** `Promise<void>`

```typescript
import { saveBaseline } from 'llm-regression';

await saveBaseline(
  [
    { id: 'q1', output: 'Paris is the capital of France.', input: 'What is the capital?' },
    { id: 'q2', output: '4', input: 'What is 2 + 2?' },
  ],
  './baselines/v1.json',
  { promptVersion: 'v1.0.0', model: 'gpt-4o-mini' }
);
```

The resulting JSON file has the structure:

```json
{
  "__meta": {
    "version": 1,
    "createdAt": "2026-03-22T00:00:00.000Z",
    "promptVersion": "v1.0.0",
    "model": "gpt-4o-mini"
  },
  "entries": [
    { "id": "q1", "output": "Paris is the capital of France.", "input": "What is the capital?" }
  ]
}
```

---

### `loadBaseline(filePath)`

Load baseline outputs from a JSON file. Validates the file structure.

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `filePath` | `string` | Path to the baseline JSON file. |

**Returns:** `Promise<BaselineFile>`

```typescript
import { loadBaseline } from 'llm-regression';

const baseline = await loadBaseline('./baselines/v1.json');
console.log(baseline.__meta.promptVersion); // 'v1.0.0'
console.log(baseline.entries[0].output);    // 'Paris is the capital of France.'
```

---

### Metric Functions

All metric functions are exported individually for direct use outside the comparison pipeline.

#### `exactMatch(baseline, candidate, options?)`

Binary match (1.0 or 0.0) after optional normalization.

| Option | Type | Default | Description |
|---|---|---|---|
| `trim` | `boolean` | `true` | Trim leading/trailing whitespace. |
| `normalizeWhitespace` | `boolean` | `true` | Collapse internal whitespace to single spaces. |
| `caseSensitive` | `boolean` | `false` | Whether comparison is case-sensitive. |

```typescript
import { exactMatch } from 'llm-regression';

exactMatch('Hello  World', 'hello world');                      // 1.0
exactMatch('Hello', 'hello', { caseSensitive: true });          // 0.0
exactMatch('  hello  ', 'hello');                                // 1.0
exactMatch('hello   world', 'hello world');                      // 1.0
```

#### `jaccardSimilarity(baseline, candidate, options?)`

Token set intersection over union. Returns a score in the range [0.0, 1.0].

| Option | Type | Default | Description |
|---|---|---|---|
| `caseSensitive` | `boolean` | `false` | Whether tokenization preserves case. |
| `removeStopwords` | `boolean` | `false` | Whether to remove common English stopwords before comparison. |

```typescript
import { jaccardSimilarity } from 'llm-regression';

jaccardSimilarity('the quick brown fox', 'the quick brown fox'); // 1.0
jaccardSimilarity('cat dog bird', 'apple orange banana');        // 0.0
jaccardSimilarity('hello world', 'hello there');                 // 0.333...
jaccardSimilarity('the cat', 'the dog', { removeStopwords: true }); // 0.0
```

#### `rougeL(baseline, candidate)`

Longest Common Subsequence F1 score. Returns a score in the range [0.0, 1.0]. Case-insensitive. Order-sensitive (unlike Jaccard).

```typescript
import { rougeL } from 'llm-regression';

rougeL('the quick brown fox', 'the quick brown fox'); // 1.0
rougeL('a b c d e', 'a b c');                         // 0.75
rougeL('paris is capital', 'capital is paris');        // 0.333...
```

#### `bleuScore(baseline, candidate, options?)`

Modified n-gram precision with brevity penalty. Returns a score in the range [0.0, 1.0].

| Option | Type | Default | Description |
|---|---|---|---|
| `maxN` | `number` | `4` | Maximum n-gram order. |
| `weights` | `number[]` | Uniform `1/maxN` | Weight for each n-gram level. |

```typescript
import { bleuScore } from 'llm-regression';

bleuScore('hello world', 'hello world', { maxN: 1 }); // 1.0
bleuScore('a b c d e', 'a b c', { maxN: 2 });         // ~0.513 (brevity penalty applied)
bleuScore('cat dog bird', 'apple orange banana');       // 0.0
```

Note: BLEU returns 0 if any n-gram level has zero precision, and short sentences (fewer tokens than `maxN`) may score 0 for higher n-gram levels.

#### `containsScore(baseline, candidate, options?)`

Phrase containment check. When `phrases` is provided, returns the fraction of phrases found in the candidate. Otherwise, checks whether the baseline string is contained in the candidate.

| Option | Type | Default | Description |
|---|---|---|---|
| `phrases` | `string[]` | -- | Explicit phrases to search for in the candidate. |
| `caseSensitive` | `boolean` | `false` | Whether the search is case-sensitive. |

```typescript
import { containsScore } from 'llm-regression';

// Phrase mode
containsScore('', 'Paris is the capital of France.', { phrases: ['Paris', 'capital'] }); // 1.0
containsScore('', 'Hello world', { phrases: ['Paris', 'capital'] });                     // 0.0

// Baseline containment mode
containsScore('capital of France', 'Paris is the capital of France.');                   // 1.0
containsScore('capital of Germany', 'Paris is the capital of France.');                  // 0.0
```

#### `structuralSimilarity(baseline, candidate, options?)`

JSON structure comparison. Parses both strings as JSON and compares key presence, types, and nesting. Returns 0.0 if either string is not valid JSON.

| Option | Type | Default | Description |
|---|---|---|---|
| `allowExtraKeys` | `boolean` | `false` | Whether extra keys in the candidate are penalized. |
| `allowMissingKeys` | `boolean` | `false` | Whether missing keys in the candidate are penalized. |
| `checkArrayLength` | `boolean` | `false` | Whether array length mismatches cause a score of 0. |

```typescript
import { structuralSimilarity } from 'llm-regression';

structuralSimilarity('{"name":"Alice","age":30}', '{"name":"Bob","age":25}');       // 1.0
structuralSimilarity('{"a":1,"b":2,"c":3}', '{"a":1}');                             // 0.333...
structuralSimilarity('{"a":1}', '{"a":1,"b":2}', { allowExtraKeys: true });         // 1.0
structuralSimilarity('not json', '{"key":"value"}');                                 // 0.0
```

#### `computeMetric(id, baseline, candidate, options?)`

Dispatcher that routes to the correct metric function by `MetricId`. Returns `NaN` for `'semantic'` and `'custom'` metrics, which require async handling through `compare()`.

```typescript
import { computeMetric } from 'llm-regression';

computeMetric('jaccard', 'hello world', 'hello world');  // 1.0
computeMetric('exact', 'hello', 'hello');                 // 1.0
computeMetric('semantic', 'a', 'b');                      // NaN (requires embedFn)
```

---

## Configuration

### Metric Selection

Specify a single metric or multiple metrics per comparison:

```typescript
// Single metric
await compare(baseline, candidate, { metric: 'jaccard' });

// Multiple metrics (overrides `metric`)
await compare(baseline, candidate, { metrics: ['jaccard', 'rouge-l', 'bleu'] });

// Default when none specified: ['exact', 'jaccard', 'rouge-l']
await compare(baseline, candidate);
```

### Threshold Configuration

Thresholds determine the boundary between `neutral` and `regression`. They are resolved in priority order:

1. Per-test-case threshold (via `TestCase.thresholds`)
2. Per-call threshold (via `options.thresholds`)
3. Factory config threshold (via `createRegression` config)
4. Metric default threshold

```typescript
// Per-call thresholds
await compare(baseline, candidate, {
  metrics: ['jaccard', 'rouge-l'],
  thresholds: { jaccard: 0.7, 'rouge-l': 0.8 },
});

// Per-test-case thresholds override per-call thresholds
await compareBatch([
  { id: 'strict', baseline: 'a', candidate: 'b', thresholds: { jaccard: 0.95 } },
  { id: 'lenient', baseline: 'a', candidate: 'b', thresholds: { jaccard: 0.3 } },
]);
```

### Default Thresholds

| Metric | Default Threshold |
|---|---|
| `exact` | 1.0 |
| `jaccard` | 0.60 |
| `rouge-l` | 0.70 |
| `bleu` | 0.50 |
| `semantic` | 0.85 |
| `contains` | 1.0 |
| `structural` | 1.0 |
| `custom` | 0.70 |

### Aggregate Threshold

The `aggregateThreshold` determines whether a batch overall passes or fails. It is the minimum fraction of test cases that must be `neutral` or `improvement`:

```typescript
await compareBatch(testCases, {
  aggregateThreshold: 0.95, // 95% of cases must pass
});
```

The default aggregate threshold is `0.90`.

### Metric-Specific Options

Each metric accepts additional configuration through its dedicated options key:

```typescript
await compare(baseline, candidate, {
  metrics: ['jaccard', 'bleu', 'exact', 'contains', 'structural'],
  jaccard: { caseSensitive: false, removeStopwords: true },
  bleu: { maxN: 4, weights: [0.25, 0.25, 0.25, 0.25] },
  exact: { trim: true, normalizeWhitespace: true, caseSensitive: false },
  contains: { phrases: ['Paris', 'France'], caseSensitive: false },
  structural: { allowExtraKeys: true, allowMissingKeys: false, checkArrayLength: true },
});
```

### Semantic Similarity

The `semantic` metric requires a user-provided embedding function:

```typescript
await compare(baseline, candidate, {
  metric: 'semantic',
  embedFn: async (text: string): Promise<number[]> => {
    // Call your embedding API (OpenAI, Cohere, local model, etc.)
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  },
});
```

### Custom Metrics

Provide a custom scoring function for domain-specific evaluation:

```typescript
await compare(baseline, candidate, {
  metric: 'custom',
  customMetricFn: (baseline: string, candidate: string) => {
    // Your scoring logic -- return { score: number, details?: string }
    const baseWords = new Set(baseline.split(' '));
    const candWords = new Set(candidate.split(' '));
    const overlap = [...baseWords].filter(w => candWords.has(w)).length;
    return { score: overlap / baseWords.size, details: `${overlap} words overlap` };
  },
  thresholds: { custom: 0.5 },
});
```

Custom metric functions can be synchronous or asynchronous.

---

## Error Handling

### Baseline File Errors

`loadBaseline` throws when the file does not exist, contains invalid JSON, or is missing required fields:

```typescript
try {
  const baseline = await loadBaseline('./nonexistent.json');
} catch (error) {
  // Error: ENOENT: no such file or directory, open './nonexistent.json'
}

try {
  const baseline = await loadBaseline('./corrupt.json');
} catch (error) {
  // Error: Unexpected token ... in JSON at position ...
  // or: Invalid baseline file at ./corrupt.json: missing __meta or entries
}
```

### Metric Errors

- **Semantic metric without `embedFn`**: Returns `NaN` for the score. The comparison still completes; the metric is excluded from the primary score calculation.
- **Custom metric without `customMetricFn`**: Returns `NaN` for the score.
- **Structural metric with non-JSON input**: Returns `0.0`.
- **BLEU with empty candidate**: Returns `0.0`.

### Batch Processing

`compareBatch` processes test cases in chunks determined by the `concurrency` option. If an individual comparison fails, the error propagates from `Promise.all` for that batch. Structure your test cases to avoid throwing from metric functions.

---

## Advanced Usage

### CI Pipeline Integration

Use `compareBatch` in test frameworks to gate deployments on regression detection:

```typescript
import { describe, it, expect } from 'vitest';
import { compareBatch } from 'llm-regression';

describe('prompt regression', () => {
  it('should not regress on core test cases', async () => {
    const testCases = [
      { id: 'capital', baseline: 'Paris is the capital of France.', candidate: getNewOutput('capital') },
      { id: 'math', baseline: '4', candidate: getNewOutput('math') },
    ];

    const report = await compareBatch(testCases, {
      metrics: ['jaccard', 'rouge-l'],
      thresholds: { jaccard: 0.6, 'rouge-l': 0.7 },
      aggregateThreshold: 0.95,
    });

    expect(report.summary.passed).toBe(true);

    if (!report.summary.passed) {
      for (const regression of report.regressions) {
        console.log(`REGRESSION ${regression.testId}: ${JSON.stringify(regression.scores)}`);
        console.log(`  baseline:  ${regression.baseline}`);
        console.log(`  candidate: ${regression.candidate}`);
      }
    }
  });
});
```

### Baseline Workflow

Capture baseline outputs once, then compare candidate outputs against them in subsequent runs:

```typescript
import { saveBaseline, loadBaseline, compareBatch } from 'llm-regression';
import type { TestCase } from 'llm-regression';

// Step 1: Capture baselines (run once)
await saveBaseline(
  [
    { id: 'q1', output: 'Paris is the capital of France.', input: 'capital question' },
    { id: 'q2', output: '4', input: 'math question' },
  ],
  './baselines/v1.json',
  { promptVersion: 'v1.0.0', model: 'gpt-4o-mini' }
);

// Step 2: Compare new outputs against baselines (run on each change)
const baseline = await loadBaseline('./baselines/v1.json');
const testCases: TestCase[] = baseline.entries.map(entry => ({
  id: entry.id,
  input: entry.input,
  baseline: entry.output,
  candidate: await generateNewOutput(entry.input),
}));
const report = await compareBatch(testCases);
```

### Multi-Metric Scoring

Run multiple metrics simultaneously for comprehensive comparison:

```typescript
const result = await compare(
  '{"name": "Alice", "age": 30, "city": "Paris"}',
  '{"name": "Bob", "age": 25, "city": "Paris"}',
  {
    metrics: ['structural', 'exact', 'jaccard'],
    thresholds: { structural: 1.0, exact: 1.0, jaccard: 0.5 },
    structural: { allowExtraKeys: false },
  }
);

// result.scores.structural -- 1.0 (same JSON structure)
// result.scores.exact      -- 0.0 (different values)
// result.scores.jaccard    -- partial overlap
// result.primaryScore      -- average of all scores
```

### Progress Tracking

Monitor progress during large batch comparisons:

```typescript
const report = await compareBatch(largeTestSuite, {
  metrics: ['jaccard'],
  concurrency: 10,
  onProgress: (completed, total) => {
    const pct = ((completed / total) * 100).toFixed(1);
    process.stdout.write(`\rProgress: ${pct}% (${completed}/${total})`);
  },
});
```

### Factory with Semantic Metric

Pre-configure a tester with an embedding function for reuse:

```typescript
const tester = createRegression({
  metrics: ['semantic', 'jaccard'],
  thresholds: { semantic: 0.85, jaccard: 0.6 },
  aggregateThreshold: 0.90,
  embedFn: async (text) => {
    const response = await embeddingApi.embed(text);
    return response.vector;
  },
});

// All calls use the configured embedFn automatically
const result = await tester.compare(baselineText, candidateText);
```

---

## Supported Metrics

| Metric | ID | Description | Range | Default Threshold |
|---|---|---|---|---|
| Exact Match | `exact` | Binary match after trim, whitespace normalization, and case folding | 0 or 1 | 1.0 |
| Jaccard Similarity | `jaccard` | Token set intersection over union | [0, 1] | 0.60 |
| ROUGE-L | `rouge-l` | Longest common subsequence F1 score | [0, 1] | 0.70 |
| BLEU | `bleu` | N-gram precision with brevity penalty | [0, 1] | 0.50 |
| Semantic Similarity | `semantic` | Cosine similarity of embedding vectors | [-1, 1] | 0.85 |
| Contains | `contains` | Phrase/substring containment check | [0, 1] | 1.0 |
| Structural | `structural` | JSON key/type structure comparison | [0, 1] | 1.0 |
| Custom | `custom` | User-provided scoring function | [0, 1] | 0.70 |

---

## Classification

Each comparison is classified based on the primary score (average of all non-NaN metric scores) against the primary metric's threshold:

- **`neutral`** -- the primary score is at or above the threshold. The candidate output is acceptable.
- **`regression`** -- the primary score is below the threshold. The candidate output has degraded.
- **`improvement`** -- reserved for ground-truth comparison workflows.

---

## TypeScript

All types are exported from the package entry point. Import them directly:

```typescript
import type {
  // Input types
  TestCase,
  TestInput,

  // Metric types
  MetricId,
  MetricThresholds,
  MetricScores,
  EmbedFn,
  LlmFn,
  CustomMetricFn,
  CustomMetricResult,

  // Classification types
  Classification,
  ClassificationMode,

  // Result types
  ComparisonResult,
  MetricStats,
  BatchSummary,
  BatchReport,
  RegressionReport,

  // Options types
  CompareOptions,
  BatchOptions,
  RegressionOptions,
  RegressionConfig,
  RegressionTester,

  // Baseline types
  BaselineEntry,
  BaselineFile,
  SaveBaselineOptions,
} from 'llm-regression';
```

### Key Type Definitions

**`TestCase`** -- a test case with pre-generated outputs:

```typescript
interface TestCase {
  id?: string;
  input?: string;
  baseline: string;
  candidate: string;
  metadata?: Record<string, unknown>;
  thresholds?: MetricThresholds;
}
```

**`ComparisonResult`** -- result of a single comparison:

```typescript
interface ComparisonResult {
  testId: string;
  baseline: string;
  candidate: string;
  input?: string;
  scores: MetricScores;
  primaryScore: number;
  classification: Classification;
  diff: string;
  durationMs: number;
  metricResults: Record<string, { score: number; threshold: number; passed: boolean }>;
}
```

**`BatchReport`** -- result of a batch comparison:

```typescript
interface BatchReport {
  summary: BatchSummary;
  metrics: MetricId[];
  thresholds: MetricThresholds;
  aggregateThreshold: number;
  results: ComparisonResult[];
  regressions: ComparisonResult[];
  improvements: ComparisonResult[];
  neutrals: ComparisonResult[];
  aggregateScores: Record<string, MetricStats>;
  formatted: string;
  timestamp: string;
  durationMs: number;
}
```

**`MetricId`** -- union of all supported metric identifiers:

```typescript
type MetricId = 'semantic' | 'jaccard' | 'rouge-l' | 'bleu' | 'exact' | 'contains' | 'structural' | 'custom';
```

---

## License

MIT
