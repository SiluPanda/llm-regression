# llm-regression -- Implementation Tasks

## Phase 1: Project Setup and Types

- [x] **Install dev dependencies** — Add `typescript`, `vitest`, and `eslint` as devDependencies in `package.json`. Add `bin` field pointing to `dist/cli.js`. Verify `npm install` succeeds. | Status: done

- [x] **Define all TypeScript types in `src/types.ts`** — Create the types file with all interfaces and type aliases from the spec: `TestCase`, `TestInput`, `MetricId`, `MetricThresholds`, `MetricScores`, `EmbedFn`, `LlmFn`, `CustomMetricFn`, `CustomMetricResult`, `Classification`, `ClassificationMode`, `ComparisonResult`, `MetricStats`, `BatchSummary`, `BatchReport`, `RegressionReport`, `CompareOptions`, `BatchOptions`, `RegressionOptions`, `RegressionConfig`, `RegressionTester`, `BaselineEntry`, `BaselineFile`, `SaveBaselineOptions`. All types must be exported. | Status: done

- [x] **Set up `src/index.ts` barrel exports** — Replace the placeholder content with proper re-exports. Initially export all types from `types.ts`. As modules are implemented, add exports for `compare`, `compareBatch`, `runRegression`, `createRegression`, `saveBaseline`, `loadBaseline`. | Status: done

- [x] **Create directory structure** — Create all directories specified in the file structure: `src/metrics/`, `src/baseline/`, `src/format/`, `src/utils/`, `src/__tests__/`, `src/__tests__/metrics/`. | Status: done

## Phase 2: Utility Modules

- [ ] **Implement `src/utils/tokenizer.ts`** — Word tokenization function: split text on whitespace and punctuation, return array of lowercase tokens. Support `caseSensitive` option to preserve original casing. Handle empty strings, unicode, and emoji gracefully. | Status: not_done

- [ ] **Implement `src/utils/stopwords.ts`** — Export a `Set<string>` of ~150 common English stopwords (the, a, an, is, are, was, were, etc.) and a `removeStopwords(tokens: string[]): string[]` function that filters them out. | Status: not_done

- [ ] **Implement `src/utils/cosine.ts`** — Cosine similarity computation for two number arrays: `cosineSimilarity(a: number[], b: number[]): number`. Compute `dot(a,b) / (norm(a) * norm(b))`. Handle zero-length vectors by throwing an error. Handle mismatched dimensions by throwing an error. | Status: not_done

- [ ] **Implement `src/utils/lcs.ts`** — Longest common subsequence computation using dynamic programming: `lcsLength(a: string[], b: string[]): number`. Takes two arrays of tokens and returns the LCS length. Must handle large inputs without stack overflow (iterative DP, not recursive). | Status: not_done

- [ ] **Implement `src/utils/ngrams.ts`** — N-gram extraction: `extractNgrams(tokens: string[], n: number): Map<string, number>`. Returns a map from n-gram string (joined by space) to count. Support n from 1 to 4. Handle cases where token array is shorter than n. | Status: not_done

- [ ] **Implement `src/utils/sentences.ts`** — Rule-based sentence boundary detection: `splitSentences(text: string): string[]`. Split on `.`, `!`, `?` followed by whitespace or end of string. Handle abbreviations (e.g., "Mr.", "Dr.") gracefully. Handle empty strings (return empty array). | Status: not_done

- [ ] **Implement `src/utils/stats.ts`** — Statistical aggregation functions: `mean(values: number[]): number`, `median(values: number[]): number`, `min(values: number[]): number`, `max(values: number[]): number`, `stddev(values: number[]): number`. Handle empty arrays (return 0). Handle single-element arrays. | Status: not_done

- [ ] **Implement `src/utils/deep-equal.ts`** — Deep equality and structural comparison utilities for JSON values. Recursive comparison of objects/arrays checking key presence, type matching, and optionally array length. Return a structured result indicating matched/total fields. | Status: not_done

## Phase 3: Similarity Metrics

- [x] **Implement `src/metrics/jaccard.ts`** — Jaccard similarity metric. Tokenize both strings (using tokenizer), optionally remove stopwords, compute set intersection over set union. Support `caseSensitive` (default false) and `removeStopwords` (default true) options. Return score in [0, 1]. Return 0.0 if both strings are empty (union is empty). Default threshold: 0.60. | Status: done

- [x] **Implement `src/metrics/rouge-l.ts`** — ROUGE-L metric. Tokenize both strings, compute LCS length using `lcs.ts`, compute precision (`lcs/candidate_length`), recall (`lcs/baseline_length`), and F1 score (`2*P*R/(P+R)`). Return 0.0 if both P and R are 0. Default threshold: 0.70. | Status: done

- [x] **Implement `src/metrics/bleu.ts`** — BLEU metric. Tokenize both strings, extract n-grams for n=1..maxN (default 4), compute clipped precision for each n, compute brevity penalty, compute geometric mean with weights (default uniform). Use smoothing (epsilon 1e-10) to handle zero-precision n-gram levels. Support `maxN` and `weights` options. Default threshold: 0.50. | Status: done

- [x] **Implement `src/metrics/exact.ts`** — Exact match metric. Optionally trim whitespace (default true), optionally normalize whitespace (default false), optionally case-insensitive (default case-sensitive). Return 1.0 if identical after normalization, 0.0 otherwise. Default threshold: 1.0. | Status: done

- [x] **Implement `src/metrics/contains.ts`** — Contains match metric. If `phrases` option is provided, use those; otherwise split baseline into sentences using `sentences.ts`. Check each phrase against the candidate using `includes()`. Support `caseSensitive` option (default false). Return `matchedPhrases / totalPhrases`. Return 1.0 if no phrases (vacuously true). Default threshold: 1.0. | Status: done

- [x] **Implement `src/metrics/structural.ts`** — Structural match metric. Parse both strings as JSON (score 0.0 if parse fails). Recursively walk both objects comparing keys and types. Support `allowExtraKeys` (default false), `allowMissingKeys` (default false), `checkArrayLength` (default true). Return `matchedFields / totalFields`. Default threshold: 1.0. | Status: done

- [ ] **Implement `src/metrics/semantic.ts`** — Semantic similarity metric. Call the user-provided `embedFn` on both baseline and candidate strings to get embedding vectors. Compute cosine similarity using `cosine.ts`. Throw descriptive error if `embedFn` is not provided, if it throws, or if it returns a zero-length vector. Default threshold: 0.85. | Status: not_done

- [ ] **Implement `src/metrics/custom.ts`** — Custom metric wrapper. Call the user-provided `CustomMetricFn` with baseline and candidate. Await the result if it's a Promise. Validate that score is in [0, 1] -- clamp if out of range. Propagate errors from the function with descriptive wrapping. Default threshold: 0.70. | Status: not_done

## Phase 4: Classification Logic

- [ ] **Implement `src/classify.ts`** — Classification logic. Given metric scores and thresholds, classify a comparison as `regression`, `improvement`, or `neutral`. Support single-metric classification: below threshold = regression, at or above = neutral. Support improvement detection: when `groundTruth` is provided, compare both baseline and candidate against ground truth; if candidate is closer, classify as improvement. Support improvement threshold (baseline score + 0.10 on quality metric). | Status: not_done

- [ ] **Implement multi-metric classification modes in `src/classify.ts`** — Support `'any'` mode (default): regression if any metric is below its threshold. Support `'all'` mode: regression only if all metrics are below their thresholds. | Status: not_done

- [ ] **Implement composite scoring in `src/classify.ts`** — When `compositeWeights` is configured, compute a weighted average of metric scores. Classify based on the composite score vs. `compositeThreshold`. | Status: not_done

- [ ] **Implement threshold resolution in `src/classify.ts`** — Resolve thresholds in priority order: per-test-case threshold > per-call threshold > createRegression config threshold > metric default threshold. Encapsulate this logic in a reusable function. | Status: not_done

## Phase 5: Single-Pair Comparison (`compare`)

- [x] **Implement `src/compare.ts`** — The `compare(baseline, candidate, options?)` function. Accept two strings and optional `CompareOptions`. Determine which metric(s) to use (single `metric` or multiple `metrics`; default `'jaccard'`). Dispatch to the appropriate metric module(s). Collect scores. Generate a human-readable diff between baseline and candidate. Classify the result. Measure duration. Return a `ComparisonResult` with all fields populated: `testId` (auto-generate if not provided), `baseline`, `candidate`, `input`, `scores`, `primaryScore`, `classification`, `diff`, `durationMs`, `metricResults`. | Status: done

- [x] **Implement diff generation in `src/compare.ts`** — Generate a human-readable diff between baseline and candidate strings. Show word-level or line-level differences. This is stored in `ComparisonResult.diff`. | Status: done

## Phase 6: Batch Comparison (`compareBatch`)

- [x] **Implement `src/compare-batch.ts`** — The `compareBatch(testCases, options?)` function. Accept an array of `TestCase` objects and optional `BatchOptions`. Process each test case through `compare()`. Implement concurrency control with configurable limit (default 10). Aggregate results into a `BatchReport`. | Status: done

- [x] **Implement aggregate statistics in `src/compare-batch.ts`** — For each metric used, compute aggregate statistics across all test cases: mean, median, min, max, stddev, passRate. Store in `BatchReport.aggregateScores`. | Status: done

- [x] **Implement pass/fail determination in `src/compare-batch.ts`** — Compute passRate as `(neutral + improvements) / total`. Compare against `aggregateThreshold` (default 0.90). Set `summary.passed` accordingly. Populate `summary.total`, `summary.neutral`, `summary.improvements`, `summary.regressions`. | Status: done

- [x] **Implement per-test-case threshold overrides in `src/compare-batch.ts`** — When a `TestCase` has a `thresholds` field, pass those thresholds to the comparison for that test case, overriding global/per-call thresholds. | Status: done

- [x] **Implement progress callback in `src/compare-batch.ts`** — Call `onProgress(completed, total)` after each comparison completes, if the callback is provided in options. | Status: done

- [ ] **Implement formatted output in `src/compare-batch.ts`** — After computing results, format the report using the requested format (default `'terminal'`). Store the formatted string in `BatchReport.formatted`. | Status: not_done

## Phase 7: Output Formatters

- [ ] **Implement `src/format/colors.ts`** — ANSI color utilities. Provide functions for green, red, yellow, cyan, bold, dim text. Detect `NO_COLOR` environment variable and non-TTY stdout to disable colors. Export a `supportsColor()` function. | Status: not_done

- [ ] **Implement `src/format/terminal.ts`** — Terminal formatter. Produce colored output showing each test case with a check/cross mark, test ID, score with visual gauge bar, and classification. Below the summary, show expanded details for each regression (baseline, candidate, scores, thresholds). End with a summary line showing counts and pass rate. Respect `NO_COLOR` and non-TTY detection. | Status: not_done

- [ ] **Implement `src/format/json.ts`** — JSON formatter. Produce a valid JSON string matching the schema shown in the spec: `summary`, `metrics`, `thresholds`, `aggregateThreshold`, `results`, `regressions`, `aggregateScores`, `timestamp`, `durationMs`. Use `JSON.stringify` with 2-space indent. | Status: not_done

- [ ] **Implement `src/format/markdown.ts`** — Markdown formatter. Produce a Markdown string suitable for PR comments. Include a status header, a table with test case rows (test ID, metric scores, classification), collapsible `<details>` sections for each regression showing baseline and candidate outputs. End with pass rate and metrics summary. | Status: not_done

- [ ] **Implement `src/format/html.ts`** — HTML formatter. Produce a self-contained HTML file with inline CSS and JavaScript. Show a summary section, a table of all test cases with color-coded scores, collapsible rows for side-by-side comparison. Regressions are highlighted and expanded by default. No external dependencies (all CSS/JS inline). | Status: not_done

## Phase 8: End-to-End Regression Pipeline (`runRegression`)

- [ ] **Implement `src/run-regression.ts`** — The `runRegression(testInputs, baselinePrompt, candidatePrompt, llmFn, options?)` function. For each test input, compose the prompt using `composePrompt` (default: `prompt + input`). Call `llmFn` for both baseline and candidate prompts. Implement concurrency control for LLM calls with `llmConcurrency` (default 5). Collect all outputs. Build `TestCase` array from baseline/candidate output pairs. Pass to `compareBatch`. Return a `RegressionReport` extending `BatchReport` with `baselinePrompt`, `candidatePrompt`, `llmCalls` (2 * n), and `estimatedTokens`. | Status: not_done

- [ ] **Implement LLM call concurrency control in `src/run-regression.ts`** — Use a concurrency limiter (semaphore pattern or p-limit equivalent implemented inline) to limit concurrent LLM calls to `llmConcurrency`. Handle LLM function errors gracefully (report which test input failed). | Status: not_done

- [ ] **Implement prompt composition in `src/run-regression.ts`** — Support the `composePrompt` option. Default is `(prompt, input) => prompt + input`. Allow users to provide custom composition logic (e.g., template interpolation, chat message formatting). | Status: not_done

## Phase 9: Factory (`createRegression`)

- [ ] **Implement `src/create-regression.ts`** — The `createRegression(config)` factory function. Accept a `RegressionConfig` object. Return a `RegressionTester` instance with `compare`, `compareBatch`, and `runRegression` methods. Each method merges the instance defaults with per-call options (per-call options take priority). | Status: not_done

- [x] **Implement option merging in `src/create-regression.ts`** — When a method is called on the `RegressionTester`, merge the instance config with the call-specific options. Per-call options override instance defaults. Threshold merging should be deep (per-metric). | Status: done

## Phase 10: Baseline Management

- [ ] **Implement `src/baseline/format.ts`** — Baseline file serialization/deserialization. Define the baseline file JSON schema: `{ __meta: { version, createdAt, promptVersion?, model? }, entries: BaselineEntry[] }`. Provide `serialize(entries, options)` and `deserialize(json)` functions. Validate the schema version on deserialization. | Status: not_done

- [ ] **Implement `src/baseline/save.ts`** — The `saveBaseline(results, path, options?)` function. Accept an array of `BaselineEntry` objects, a file path, and optional `SaveBaselineOptions` (promptVersion, model, timestamp). Serialize to JSON using `format.ts`. Create parent directories if they don't exist (`fs.mkdir` recursive). Write the file atomically (write to temp file, rename). | Status: not_done

- [ ] **Implement `src/baseline/load.ts`** — The `loadBaseline(path)` function. Read the file from disk. Parse as JSON. Validate the format using `format.ts`. Return the `BaselineFile` object. If the file doesn't exist, throw with a descriptive message including the path. If the file is invalid JSON, throw with the parse error and file path. | Status: not_done

## Phase 11: CLI

- [ ] **Implement `src/cli.ts` entry point** — CLI entry point with shebang (`#!/usr/bin/env node`). Parse command-line arguments (use `process.argv` parsing or a minimal arg parser -- no external deps). Support the `run` (default), `compare`, and `baseline` subcommands. | Status: not_done

- [ ] **Implement CLI `run` command** — Parse `--config/-c` (required), `--format/-f`, `--metric/-m`, `--threshold/-t`, `--aggregate-threshold`, `--baseline/-b`, `--candidate`, `--no-color`, `--quiet/-q`, `--verbose/-v` flags. Load config from JSON file. Load test cases from the config-specified file or `--baseline`/`--candidate` files. Run `compareBatch`. Print formatted output (or suppress with `--quiet`). Exit with code 0 (pass), 1 (fail), or 2 (config error). | Status: not_done

- [ ] **Implement CLI `compare` command** — Accept `--baseline` and `--candidate` as inline strings, plus `--metric` and `--threshold`. Call `compare()` and print the result. | Status: not_done

- [ ] **Implement CLI `baseline` subcommands** — `baseline show <path>`: load and pretty-print a baseline file. `baseline validate <path>`: load a baseline file and report whether it's valid or list errors. Exit code 0 on success, 2 on error. | Status: not_done

- [ ] **Implement CLI error handling** — Catch all errors, print user-friendly messages to stderr, exit with code 2 for configuration/usage errors. Handle missing config file, invalid JSON in config file, missing required options, invalid metric names, invalid threshold values. | Status: not_done

- [x] **Add `bin` field to `package.json`** — Add `"bin": { "llm-regression": "dist/cli.js" }` to package.json so the CLI is available after install. | Status: done

## Phase 12: Unit Tests -- Metrics

- [x] **Write tests for Jaccard metric (`src/__tests__/metrics/jaccard.test.ts`)** — Test cases per spec: identical strings (score 1.0), completely different strings (score 0.0), same words different order (score 1.0), partial overlap (proportional score verified against hand calc), stopword removal, case sensitivity (default insensitive, configurable), empty strings (score 0.0), threshold boundary (at threshold = pass, below = fail). | Status: done

- [x] **Write tests for ROUGE-L metric (`src/__tests__/metrics/rouge-l.test.ts`)** — Test cases: identical sequences (1.0), completely different (0.0), subsequence present (proportional score), word order matters (reversed scores lower), one string is substring of other (precision/recall asymmetry), empty strings (0.0). | Status: done

- [x] **Write tests for BLEU metric (`src/__tests__/metrics/bleu.test.ts`)** — Test cases: identical strings (close to 1.0), completely different (near 0.0 with smoothing), brevity penalty (short candidate penalized), n-gram precision (hand-calculated for small examples), smoothing (zero-precision levels handled). | Status: done

- [x] **Write tests for Exact metric (`src/__tests__/metrics/exact.test.ts`)** — Test cases: identical strings (1.0), different strings (0.0), whitespace trimming (trailing spaces ignored when trim:true), case sensitivity (respects config), whitespace normalization (multiple spaces collapsed when configured). | Status: done

- [x] **Write tests for Contains metric (`src/__tests__/metrics/contains.test.ts`)** — Test cases: all phrases present (1.0), some missing (proportional), case insensitivity (default), custom phrase list, empty phrase list (1.0 vacuously), empty candidate with expected phrases (0.0). | Status: done

- [x] **Write tests for Structural metric (`src/__tests__/metrics/structural.test.ts`)** — Test cases: identical JSON (1.0), same keys different values (1.0), missing key (reduced score), extra key (fail when allowExtraKeys:false, pass when true), type mismatch, nested objects (recursive), arrays (same/different length, element types), non-JSON input (0.0). | Status: done

- [ ] **Write tests for Semantic metric (`src/__tests__/metrics/semantic.test.ts`)** — Use a mock embedder. Test cases: identical texts (1.0 from identical embeddings), orthogonal embeddings (0.0), similar embeddings above threshold (pass), dissimilar below threshold (fail), embedder throws (comparison fails with error), embedder returns zero vector (error). | Status: not_done

- [ ] **Write tests for Custom metric (`src/__tests__/metrics/custom.test.ts`)** — Test cases: sync function called correctly with score returned, async function awaited, function throws (error propagated), score outside [0,1] clamped. | Status: not_done

## Phase 13: Unit Tests -- Core Logic

- [ ] **Write tests for classification logic (`src/__tests__/classify.test.ts`)** — Test cases: score above threshold = neutral, score below threshold = regression, ground truth improvement detection, multi-metric 'any' mode (one below = regression), multi-metric 'all' mode (all must be below), composite scoring (weighted average vs. composite threshold). | Status: not_done

- [x] **Write tests for `compare` function (`src/__tests__/compare.test.ts`)** — End-to-end single-pair comparison tests: two strings in, ComparisonResult out, classification correct. Test with different metrics. Test with multiple metrics. Test with custom metric. Test with semantic metric (mock embedder). Verify all fields of ComparisonResult are populated. | Status: done

- [x] **Write tests for `compareBatch` function (`src/__tests__/compare-batch.test.ts`)** — Test cases per spec: all neutral (100% pass rate, passed: true), some regressions above aggregate threshold (passed: true, regressions listed), regressions below aggregate threshold (passed: false), aggregate statistics verified against manual calculation, empty test case array (passed: true), single test case. | Status: done

- [ ] **Write tests for `runRegression` function (`src/__tests__/run-regression.test.ts`)** — Integration tests with mock LLM function. Verify both prompts called for each input. Verify outputs compared correctly. Verify RegressionReport fields: baselinePrompt, candidatePrompt, llmCalls, estimatedTokens. Test with custom composePrompt. Test LLM concurrency control. Test LLM error handling. | Status: not_done

- [ ] **Write tests for `createRegression` factory (`src/__tests__/create-regression.test.ts`)** — Test instance creation with config. Verify methods use instance defaults. Verify per-call options override instance defaults. Test all three methods (compare, compareBatch, runRegression) on the instance. | Status: not_done

## Phase 14: Unit Tests -- Baseline, Format, CLI

- [ ] **Write tests for baseline management (`src/__tests__/baseline.test.ts`)** — Test cases per spec: saveBaseline creates file with correct format, creates parent directories. loadBaseline reads and parses correctly. loadBaseline with non-existent file throws. loadBaseline with corrupt file throws. Round-trip (save then load returns identical entries). Metadata preserved (promptVersion, model, timestamp). | Status: not_done

- [ ] **Write tests for output formatters (`src/__tests__/format.test.ts`)** — Terminal format: correct color codes (or lack thereof when NO_COLOR is set), regression highlighted, scores formatted. JSON format: valid JSON, matches BatchReport schema. Markdown format: valid Markdown, table structure, collapsible details. HTML format: valid HTML, self-contained. NO_COLOR support. | Status: not_done

- [ ] **Write CLI integration tests (`src/__tests__/cli.test.ts`)** — Test the CLI as a child process. Test `run` command with a config file: exit code 0 for pass, exit code 1 for fail. Test exit code 2 for config errors (missing file, invalid JSON). Test `compare` command with inline strings. Test `baseline show` and `baseline validate` commands. Test `--format` flag (terminal, json, markdown). Test `--quiet` flag. Test `--no-color` flag. | Status: not_done

## Phase 15: Unit Tests -- Edge Cases

- [ ] **Write edge case tests** — Very long outputs (100KB+): comparison completes without timeout. Unicode and emoji in outputs: all metrics handle correctly. Outputs with only whitespace: handled gracefully. Outputs with special characters (JSON special chars, regex special chars): no crashes. All test cases are regressions: pass rate 0%, passed: false. All test cases are improvements: pass rate 100%, passed: true. | Status: not_done

- [ ] **Write concurrency tests** — Concurrent comparisons in compareBatch: no race conditions. Test with concurrency: 1 (sequential). Test with concurrency greater than number of test cases. Test concurrency for LLM calls in runRegression. | Status: not_done

## Phase 16: Utility Tests

- [ ] **Write tests for tokenizer utility** — Empty string returns empty array. Single word. Multiple words. Punctuation handling. Case sensitivity option. Unicode tokens. | Status: not_done

- [ ] **Write tests for stopwords utility** — Known stopwords removed. Non-stopwords preserved. Empty input. Case handling. | Status: not_done

- [ ] **Write tests for cosine similarity utility** — Identical vectors (1.0). Orthogonal vectors (0.0). Opposite vectors (-1.0). Zero vector throws. Mismatched dimensions throws. | Status: not_done

- [ ] **Write tests for LCS utility** — Identical sequences. Completely different. Partial overlap. Empty arrays. Single element arrays. | Status: not_done

- [ ] **Write tests for n-grams utility** — Unigrams. Bigrams. Trigrams. 4-grams. Tokens shorter than n. Empty tokens. | Status: not_done

- [ ] **Write tests for sentences utility** — Simple sentences. Multiple sentences. Abbreviations. Empty string. No sentence boundary. | Status: not_done

- [ ] **Write tests for stats utility** — Mean, median, min, max, stddev for known datasets. Empty array handling. Single element. Even/odd number of elements for median. | Status: not_done

- [ ] **Write tests for deep-equal utility** — Identical objects. Different values same structure. Missing keys. Extra keys. Type mismatches. Nested objects. Arrays. Non-object inputs. | Status: not_done

## Phase 17: Documentation

- [x] **Create README.md** — Write a comprehensive README covering: package description, installation, quick start examples, API reference (compare, compareBatch, runRegression, createRegression, saveBaseline, loadBaseline), metrics table with descriptions and default thresholds, configuration reference, CLI usage, output format examples, CI integration examples (GitHub Actions), ecosystem integration (prompt-snap, prompt-diff, llm-vcr, llm-cost-per-test, output-grade), TypeScript type information. | Status: done

- [ ] **Add JSDoc comments to all public exports** — Every exported function, type, and interface should have JSDoc comments with description, parameter documentation, return type, and usage examples. | Status: not_done

## Phase 18: Build, Lint, and Final Verification

- [x] **Configure ESLint** — Set up ESLint for TypeScript. Ensure `npm run lint` passes on all source files. | Status: done

- [ ] **Verify TypeScript build** — Run `npm run build` and verify all files compile without errors. Verify `dist/` output contains `.js`, `.d.ts`, and `.d.ts.map` files for all modules. Verify the `dist/cli.js` file has the shebang line. | Status: not_done

- [ ] **Run full test suite** — Execute `npm run test` (vitest run). All tests must pass. Check code coverage for critical modules (metrics, classify, compare, compare-batch). | Status: not_done

- [ ] **End-to-end smoke test** — Run the CLI against a sample config file with real test cases. Verify exit codes. Verify all four output formats produce correct output. Verify baseline save/load round-trip. | Status: not_done

- [ ] **Version bump** — Verify version in package.json is appropriate (0.1.0 for initial release). | Status: not_done

## Phase 19: Publishing Preparation

- [ ] **Verify package.json fields** — Ensure `name`, `version`, `description`, `main`, `types`, `files`, `bin`, `engines`, `license`, `keywords`, `publishConfig` are all correct. Add relevant keywords (e.g., "llm", "regression", "testing", "prompt", "comparison", "similarity"). | Status: not_done

- [x] **Verify `files` field in package.json** — Ensure only `dist` is published. Verify `prepublishOnly` script runs build. Run `npm pack --dry-run` to check published file list. | Status: done

- [x] **Verify zero runtime dependencies** — Confirm `dependencies` field in package.json is empty or absent. All metric implementations use only built-in Node.js APIs and custom code. | Status: done
