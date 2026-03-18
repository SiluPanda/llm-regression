# llm-regression -- Specification

## 1. Overview

`llm-regression` is a semantic regression testing library for LLM prompt versions. It compares outputs from two prompt versions -- a baseline and a candidate -- using pluggable similarity metrics, classifies each change as a regression, improvement, or neutral, produces side-by-side comparison reports, and enforces configurable pass/fail thresholds. It is designed for programmatic use in test suites and CI pipelines where the question "did this prompt change make things better or worse?" needs a machine-readable answer.

The gap this package fills is specific and well-defined. When a prompt engineer modifies a prompt -- rewording instructions, adjusting few-shot examples, changing the system message, switching models -- the outputs change. Some changes are intentional improvements. Others are unintended regressions: the prompt that used to correctly answer "What is the capital of France?" with "Paris is the capital of France" now responds "France, a European country, has many cities" -- a factual regression that loses the direct answer. The fundamental challenge is that LLM outputs are non-deterministic and semantically rich. Two outputs can be textually different but semantically equivalent ("Paris is the capital of France" vs. "The capital of France is Paris"), or textually similar but semantically degraded ("Paris is the capital of France" vs. "Paris is a capital in France"). Regression detection requires semantic awareness, not string comparison.

The existing tool landscape is dominated by `promptfoo`, a prompt evaluation framework that supports regression testing through YAML configuration files, a CLI-centric workflow, and a web UI. `promptfoo` is powerful but heavy: it requires learning a configuration DSL, structuring test cases in YAML, running a separate CLI process, and interpreting results through its own reporting format. For teams that want a lightweight, programmatic regression check -- `import { compare } from 'llm-regression'` in a Vitest or Jest test file, get a typed result object, assert on it -- there is no npm package that does this. `prompt-snap` in this monorepo provides snapshot testing for LLM outputs (comparing one output against a stored baseline), but it compares a single output against a stored snapshot, not two prompt versions against each other across a test set. `prompt-diff` in this monorepo diffs the prompt templates themselves (text comparison of prompt strings), not the outputs those prompts produce. Neither tool answers the version-comparison question: "across these 50 test inputs, how did prompt v2 outputs compare to prompt v1 outputs?"

`llm-regression` provides three levels of API:

1. **Pairwise comparison**: `compare(baseline, candidate, options?)` -- compare two strings using configurable similarity metrics. Returns a `ComparisonResult` with scores, classification, and diff.
2. **Batch comparison**: `compareBatch(testCases, options?)` -- compare an array of baseline/candidate pairs. Returns a `BatchReport` with per-case results, aggregate statistics, and pass/fail determination.
3. **End-to-end regression testing**: `runRegression(testInputs, baselinePrompt, candidatePrompt, llmFn, options?)` -- run both prompts against the test inputs, compare all outputs, return a `RegressionReport`. This is the full pipeline: generate outputs, compare, classify, aggregate, report.

All three levels use the same underlying comparison engine and the same configurable metrics: semantic similarity (via pluggable embedder), Jaccard similarity (lexical overlap), ROUGE-L (longest common subsequence), BLEU (n-gram precision), exact match, contains match, structural match (for JSON outputs), and custom user-provided scoring functions. The same threshold configuration, classification logic, and reporting format apply at every level.

The design philosophy is: zero-config defaults, progressive disclosure of complexity. The simplest call -- `compare('Paris is the capital of France', 'The capital of France is Paris')` -- uses Jaccard similarity with a default threshold and returns a result. Adding `metric: 'semantic'` with an `embedFn` switches to embedding-based comparison. Adding per-metric thresholds, aggregate pass rates, and multiple simultaneous metrics layers on complexity only when needed.

---

## 2. Goals and Non-Goals

### Goals

- Provide a `compare(baseline, candidate, options?)` function that compares two LLM outputs using a configurable similarity metric and returns a `ComparisonResult` with a score, classification (regression / improvement / neutral), and a human-readable diff.
- Provide a `compareBatch(testCases, options?)` function that compares an array of baseline/candidate output pairs and returns a `BatchReport` with per-case results, aggregate scores (mean, median, min, max, standard deviation), per-metric pass rates, and an overall pass/fail determination.
- Provide a `runRegression(testInputs, baselinePrompt, candidatePrompt, llmFn, options?)` function that executes the full regression pipeline: run each test input through both prompts using a user-provided LLM function, compare the outputs, and return a `RegressionReport` with full comparison data, regression/improvement/neutral classification per test case, and aggregate statistics.
- Provide a `createRegression(config)` factory that returns a pre-configured `RegressionTester` instance with defaults for metrics, thresholds, embedder, and reporting, avoiding repeated configuration across test files.
- Implement eight similarity metrics: `semantic` (cosine similarity on embeddings), `jaccard` (word-level token overlap), `rouge-l` (longest common subsequence F1), `bleu` (n-gram precision), `exact` (string identity), `contains` (phrase inclusion), `structural` (JSON shape comparison), and `custom` (user-provided scoring function). Each metric returns a 0-1 score.
- Support running multiple metrics simultaneously on each comparison, producing a multi-metric score vector per test case and enabling composite classification based on weighted metric combinations.
- Classify each comparison as `regression` (score below the regression threshold), `improvement` (candidate scores higher than baseline on quality signals), or `neutral` (score within acceptable range) based on configurable thresholds.
- Produce side-by-side comparison output in four formats: terminal (colored diff with scores), JSON (structured report), Markdown (for PR comments), and HTML (interactive comparison view).
- Provide file-based baseline management: `saveBaseline(results, path)` and `loadBaseline(path)` for persisting and loading baseline outputs as JSON files committed to version control.
- Provide threshold configuration at three levels: global default, per-metric, and per-test-case, with a configurable aggregate threshold ("90% of test cases must pass").
- Provide a CLI (`llm-regression`) that runs regression tests from a JSON configuration file and exits with code 0 (no regressions), 1 (regressions detected), or 2 (configuration error).
- Ship complete TypeScript type definitions. All public types are exported. All configuration objects are fully typed.
- Keep runtime dependencies at zero for lexical metrics (Jaccard, ROUGE-L, BLEU, exact, contains). Semantic similarity requires a user-provided embedding function. No built-in embedding dependency.

### Non-Goals

- **Not a prompt evaluation framework.** This package compares outputs between two prompt versions. It does not evaluate absolute output quality (faithfulness, relevance, correctness). For quality evaluation, use `rag-eval-node-ts` or `output-grade` from this monorepo.
- **Not an LLM testing runner.** This package does not manage test suites, discover test files, or provide a test runner. It is a comparison library that integrates into existing test frameworks (Jest, Vitest, Mocha) or runs standalone. For test orchestration, use the test framework directly.
- **Not an embedding provider.** This package does not ship an embedding model or call any embedding API. Semantic similarity requires the caller to provide an `EmbedFn`. The package is embedding-agnostic.
- **Not a prompt management tool.** This package does not store, version, or manage prompt templates. It receives prompt strings (or outputs) as inputs. For prompt versioning, use `prompt-version` from this monorepo.
- **Not a snapshot testing library.** This package compares two outputs generated in the same test run (baseline prompt vs. candidate prompt). It does not store snapshots on disk for future comparison. For snapshot-based regression testing against stored baselines, use `prompt-snap` from this monorepo. (The two packages are complementary: `prompt-snap` compares "now vs. stored past", `llm-regression` compares "version A vs. version B".)
- **Not a promptfoo replacement.** `promptfoo` provides a complete evaluation ecosystem with YAML configuration, web UI, dataset management, and dozens of assertion types. This package provides the comparison primitive: programmatic, typed, minimal. Teams needing a full evaluation platform should use `promptfoo`. Teams needing a lightweight regression check in their existing test suite should use `llm-regression`.
- **Not a diff visualization library.** This package produces structured comparison data and simple formatted output for terminal, Markdown, and JSON. It does not generate rich interactive diff UIs. The formatted output is designed for CI logs and PR comments, not for standalone viewing tools.

---

## 3. Target Users and Use Cases

### Prompt Engineers Iterating on Prompt Versions

Engineers who modify prompts regularly -- adjusting instructions, tuning few-shot examples, changing system messages -- and need to verify that changes do not regress output quality. They define a set of test inputs that exercise the prompt's core behaviors, run both the old and new prompt versions against those inputs, and compare the outputs. `llm-regression` provides the comparison layer: for each test input, it reports whether the new output is semantically equivalent, better, or worse than the old output. The engineer sees a summary ("48/50 tests neutral, 1 improvement, 1 regression") and drills into the regression to understand what changed.

### CI Pipelines with Regression Gates

Teams that run prompt regression tests in CI on every pull request that modifies a prompt template. The CI job runs `llm-regression` against a stored baseline of outputs, compares the candidate prompt's outputs, and fails the build if regressions exceed the configured threshold. The exit code (0 = pass, 1 = regressions) integrates with any CI system. The Markdown report format is posted as a PR comment so reviewers can see the regression summary without leaving GitHub.

### Teams Migrating Between Models

When switching from one LLM to another (GPT-4 to Claude, GPT-3.5 to GPT-4, an older model version to a newer one), teams need to quantify the output differences across their entire prompt library. They run the same prompts and test inputs against both models, use `llm-regression` to compare the outputs, and get a structured report showing which prompts produce equivalent outputs and which produce significant differences. This informs which prompts need adjustment for the new model.

### A/B Prompt Evaluation

Teams evaluating two candidate prompts to decide which is better. They run both prompts against the same test inputs, compare outputs using multiple metrics (semantic similarity, structural consistency, key-phrase inclusion), and use the aggregate scores to make a data-driven decision. `llm-regression` provides the comparison infrastructure; the team provides the judgment criteria through metric selection and threshold configuration.

### Test Authors Building Regression Suites

Developers who write automated tests for LLM-powered features and want regression coverage that goes beyond exact string matching. They use `llm-regression` inside Vitest or Jest test files: `const report = await compareBatch(testCases); expect(report.passRate).toBeGreaterThanOrEqual(0.95);`. The test cases are defined programmatically, the comparison runs in-process, and the result is a typed object that standard test assertions can operate on.

### Teams Integrating with the npm-master Ecosystem

Developers using `prompt-snap` for snapshot testing, `prompt-diff` for prompt template diffing, `prompt-version` for version tracking, `llm-vcr` for recording LLM responses, `llm-cost-per-test` for cost tracking, and `output-grade` for quality scoring. `llm-regression` slots into this ecosystem as the version-comparison layer: it uses `llm-vcr` for deterministic replay during comparison, `llm-cost-per-test` for tracking the cost of running regression tests, `output-grade` as a custom metric for quality-based regression detection, and `prompt-version` for identifying which prompt version is baseline and which is candidate.

---

## 4. Core Concepts

### Baseline

The baseline is the reference output -- the output produced by the current (known-good) version of a prompt. In a regression test, the baseline represents the status quo that the candidate must match or exceed. Baselines can be:

- **Live-generated**: produced by running the baseline prompt through the LLM during the test run.
- **Stored**: loaded from a JSON file committed to version control, representing outputs captured from a previous test run.
- **Provided directly**: passed as strings in the test case definition.

### Candidate

The candidate is the output produced by the new (modified) version of a prompt. It is compared against the baseline to determine whether the change introduced a regression, improvement, or neutral effect. In the `runRegression` pipeline, the candidate is generated by running the candidate prompt through the LLM. In `compare` and `compareBatch`, the candidate is provided directly.

### Test Case

A test case (`TestCase`) is the atomic unit of regression testing. It represents one input/output pair for comparison:

- `id` (optional): A unique identifier for tracking and reporting.
- `input` (optional): The input text that was used to generate both outputs. Stored for context in reports but not used in comparison.
- `baseline`: The baseline output string.
- `candidate`: The candidate output string.
- `metadata` (optional): Arbitrary key-value pairs for grouping, filtering, or annotation.
- `thresholds` (optional): Per-test-case threshold overrides.

### Test Input

A test input (`TestInput`) is used in the `runRegression` pipeline. It represents an input that will be run through both the baseline and candidate prompts:

- `id` (optional): A unique identifier.
- `input`: The input text to send to the LLM.
- `metadata` (optional): Arbitrary key-value pairs.
- `thresholds` (optional): Per-input threshold overrides.

### Similarity Score

A similarity score is a number in the range [0, 1] produced by a similarity metric when comparing a baseline output against a candidate output. 1.0 means the outputs are identical (or maximally similar according to the metric). 0.0 means the outputs are completely dissimilar. The score is the quantitative measure of how much the output changed between prompt versions.

### Similarity Metric

A similarity metric is a named, configurable algorithm for computing the similarity between two strings. Each metric captures a different dimension of similarity:

- **Semantic**: meaning equivalence (measured by embedding cosine similarity).
- **Jaccard**: vocabulary overlap (measured by word set intersection over union).
- **ROUGE-L**: sequential overlap (measured by longest common subsequence).
- **BLEU**: n-gram precision (measured by shared n-grams).
- **Exact**: identity (binary: identical or not).
- **Contains**: inclusion (binary: all key phrases present or not).
- **Structural**: shape equivalence for JSON outputs (same keys, same types).
- **Custom**: user-defined scoring function.

### Classification

A classification is the qualitative assessment of a comparison result. Every comparison is classified into one of three categories:

- **Regression**: The candidate output is significantly worse than the baseline. The similarity score is below the regression threshold. This is the signal that the prompt change caused harm.
- **Improvement**: The candidate output is better than the baseline. Detected either by comparing against a quality reference (ground truth) or by the candidate scoring higher on a quality metric than the baseline. Improvements are informational -- they do not cause test failures.
- **Neutral**: The candidate output is within acceptable range of the baseline. The similarity score meets or exceeds the threshold, indicating the change had no meaningful negative impact on this test case.

### Threshold

A threshold is a minimum similarity score that a comparison must meet to be classified as neutral (passing) rather than a regression (failing). Thresholds are configured at three levels:

1. **Global**: applies to all comparisons (default: 0.85 for semantic, varies by metric).
2. **Per-metric**: overrides the global threshold for a specific metric.
3. **Per-test-case**: overrides all other thresholds for a specific test case.

### Comparison Report

A `ComparisonResult` is the output of comparing one baseline/candidate pair. It contains the scores from all requested metrics, the classification, the inputs, and a human-readable diff. A `BatchReport` aggregates `ComparisonResult` objects across a test set, adding statistical summaries and a pass/fail determination. A `RegressionReport` extends `BatchReport` with information about the prompts used, the LLM function, and the generation process.

### Pass Rate

The pass rate is the fraction of test cases that were classified as neutral or improvement (i.e., not regression). A pass rate of 0.95 means 95% of test cases showed no regression. The aggregate threshold (default: 0.90) sets the minimum pass rate for the overall test to pass.

---

## 5. Comparison Pipeline

The regression testing pipeline has six steps. Steps 1-3 are data preparation (handled by `runRegression` or provided by the user). Steps 4-6 are the comparison engine (shared by all API entry points).

### Step 1: Define Test Inputs

The user defines a set of inputs that exercise the prompt's core behaviors. Good test inputs cover:

- Common use cases (the prompt's primary purpose).
- Edge cases (empty input, very long input, ambiguous input).
- Known-tricky cases (inputs where previous prompt versions have regressed).
- Domain-specific cases (inputs that require domain knowledge to answer correctly).

```typescript
const testInputs: TestInput[] = [
  { id: 'capital',    input: 'What is the capital of France?' },
  { id: 'math',       input: 'What is 2 + 2?' },
  { id: 'empty',      input: '' },
  { id: 'ambiguous',  input: 'Tell me about Mercury.' },
  { id: 'long-form',  input: 'Explain the theory of relativity in detail.' },
];
```

### Step 2: Generate Baseline Outputs

Run each test input through the baseline prompt (v1) using the LLM function. The baseline outputs become the reference against which the candidate will be compared.

```
testInputs[0].input → baselinePrompt → LLM → "Paris is the capital of France."
testInputs[1].input → baselinePrompt → LLM → "2 + 2 equals 4."
...
```

In `runRegression`, this step is automatic. In `compareBatch`, the user provides pre-generated baseline outputs.

### Step 3: Generate Candidate Outputs

Run the same test inputs through the candidate prompt (v2) using the same LLM function. The candidate outputs are what the prompt change produced.

```
testInputs[0].input → candidatePrompt → LLM → "The capital of France is Paris."
testInputs[1].input → candidatePrompt → LLM → "The answer is 4."
...
```

### Step 4: Compare Each Pair

For each test case, compare the baseline output against the candidate output using the configured similarity metrics. Each metric produces an independent score.

```
Pair 0: "Paris is the capital of France." vs. "The capital of France is Paris."
  → jaccard: 0.86  (high word overlap)
  → semantic: 0.97 (same meaning)
  → rouge-l: 0.88  (long common subsequence)

Pair 1: "2 + 2 equals 4." vs. "The answer is 4."
  → jaccard: 0.25  (low word overlap)
  → semantic: 0.82 (related meaning but different framing)
  → rouge-l: 0.33  (short common subsequence)
```

### Step 5: Aggregate Results

Compute statistics across all test cases:

- **Per-metric**: mean, median, min, max, standard deviation of scores across test cases.
- **Pass rate**: fraction of test cases where all metric scores exceeded their thresholds.
- **Regression count**: number of test cases classified as regressions.
- **Improvement count**: number of test cases classified as improvements.
- **Neutral count**: number of test cases classified as neutral.

### Step 6: Classify and Report

Apply the aggregate threshold to determine the overall result:

- If the pass rate meets or exceeds the aggregate threshold (default: 0.90), the overall result is **pass**.
- If the pass rate is below the aggregate threshold, the overall result is **fail** -- regressions were detected.

Produce the final report with per-case results, aggregate statistics, classified regressions/improvements/neutral cases, and formatted output in the requested format.

### Pipeline Diagram

```
┌─────────────┐    ┌──────────────────┐    ┌───────────────────┐
│ Test Inputs  │───→│ Baseline Prompt  │───→│ Baseline Outputs  │──┐
│ (n inputs)   │    │ (v1)             │    │ (n outputs)       │  │
└─────────────┘    └──────────────────┘    └───────────────────┘  │
       │                                                           │
       │           ┌──────────────────┐    ┌───────────────────┐  │
       └──────────→│ Candidate Prompt │───→│ Candidate Outputs │  │
                   │ (v2)             │    │ (n outputs)       │  │
                   └──────────────────┘    └───────────────────┘  │
                                                                   │
                   ┌──────────────────────────────────────────────┘
                   │
                   ▼
          ┌─────────────────┐     ┌─────────────────┐
          │ Pairwise Compare│────→│ Score + Classify │
          │ (n comparisons) │     │ per test case    │
          └─────────────────┘     └────────┬────────┘
                                           │
                                           ▼
                                  ┌─────────────────┐
                                  │   Aggregate      │
                                  │   Statistics     │
                                  └────────┬────────┘
                                           │
                                           ▼
                                  ┌─────────────────┐
                                  │ Regression Report│
                                  │ (pass/fail)      │
                                  └─────────────────┘
```

---

## 6. Similarity Metrics

### 6.1 Semantic Similarity

**Metric ID**: `'semantic'`

**What it measures**: Whether two outputs mean the same thing, regardless of how they are worded. Semantic similarity captures paraphrases, synonyms, structural rearrangements, and stylistic variations that preserve meaning. "Paris is the capital of France" and "The French capital city is Paris" are semantically equivalent despite having different word order and vocabulary.

**Algorithm**:

1. Call `embedFn(baseline)` and `embedFn(candidate)` to produce embedding vectors `a` and `b`.
2. Compute cosine similarity: `score = dot(a, b) / (norm(a) * norm(b))`.
3. If `embedFn` throws or returns a zero-length vector, the comparison fails with an error.

**Formula**: `similarity = (a . b) / (||a|| * ||b||)` where `a` and `b` are embedding vectors.

**When to use**: The primary metric for most regression testing. Captures meaning equivalence across rewording, structural changes, and stylistic shifts. Use when the content and meaning of the output matter more than the exact wording.

**Sensitivity**: Highly sensitive to meaning changes, insensitive to surface-level wording changes. A factual error ("Paris is the capital of Germany") produces a significant score drop relative to the correct output. A rewording ("The capital of France is Paris" vs. "Paris serves as France's capital") produces a high score.

**Configuration**:

| Option | Type | Default | Description |
|---|---|---|---|
| `threshold` | `number` | `0.85` | Minimum cosine similarity to classify as neutral. |
| `embedFn` | `EmbedFn` | Required | `(text: string) => Promise<number[]>`. User-provided embedding function. |

**Default threshold**: 0.85. This threshold is tuned for detecting meaningful semantic regressions while tolerating natural LLM output variation. Scores above 0.85 typically indicate semantically equivalent outputs. Scores below 0.85 typically indicate a meaningful content change.

**Requirements**: Requires a user-provided `embedFn`. The function must return vectors of consistent dimensionality. `llm-regression` does not ship an embedding model or call any embedding API.

---

### 6.2 Jaccard Similarity

**Metric ID**: `'jaccard'`

**What it measures**: The word-level vocabulary overlap between two outputs. Jaccard similarity computes the size of the intersection of word sets divided by the size of the union. It captures whether the two outputs use the same words, regardless of order.

**Algorithm**:

1. Tokenize both strings: split on whitespace and punctuation, lowercase (unless `caseSensitive`).
2. If `removeStopwords`, remove tokens in the built-in English stopword list (~150 common words).
3. Compute word sets A (baseline tokens) and B (candidate tokens).
4. `intersection = A & B` (tokens in both).
5. `union = A | B` (tokens in either).
6. `score = intersection.size / union.size` (0.0 if union is empty).

**Formula**: `J(A, B) = |A ∩ B| / |A ∪ B|`

**When to use**: When embedding API calls are unavailable or too expensive. When running in CI without API keys. When vocabulary overlap is a sufficient proxy for semantic similarity -- which it often is for factual QA, technical descriptions, and outputs with domain-specific terminology. Jaccard is fast, deterministic, and requires no external dependencies.

**Sensitivity**: Sensitive to vocabulary changes, insensitive to word order. "Paris is the capital of France" vs. "France's capital is Paris" scores high (same words). "Paris is the capital of France" vs. "The French capital city is known as Paris" scores lower (different words despite same meaning). Jaccard underestimates similarity when outputs use synonyms or paraphrases.

**Configuration**:

| Option | Type | Default | Description |
|---|---|---|---|
| `threshold` | `number` | `0.60` | Minimum Jaccard similarity to classify as neutral. |
| `caseSensitive` | `boolean` | `false` | Whether word comparison is case-sensitive. |
| `removeStopwords` | `boolean` | `true` | Whether to remove common English stopwords. |

**Default threshold**: 0.60. Lower than semantic because Jaccard is a coarser measure -- identical-meaning outputs often score 0.5-0.8 on Jaccard due to vocabulary variation.

---

### 6.3 ROUGE-L

**Metric ID**: `'rouge-l'`

**What it measures**: The overlap in sequential word patterns between two outputs, measured by the longest common subsequence (LCS). ROUGE-L captures whether the two outputs share long runs of words in the same order. It is more sensitive to word order than Jaccard (which ignores order entirely) but less sensitive than exact match (which requires identical strings).

**Algorithm**:

1. Tokenize both strings into word sequences (lowercase, split on whitespace).
2. Compute the LCS length between the two word sequences using dynamic programming.
3. Compute precision: `P = lcs_length / candidate_length`.
4. Compute recall: `R = lcs_length / baseline_length`.
5. Compute F1: `score = (2 * P * R) / (P + R)`. If both P and R are 0, score is 0.

**Formula**: `ROUGE-L_F1 = (2 * P_lcs * R_lcs) / (P_lcs + R_lcs)` where `P_lcs = LCS(baseline, candidate) / |candidate|` and `R_lcs = LCS(baseline, candidate) / |baseline|`.

**When to use**: When word order matters. ROUGE-L is the standard metric for evaluating summarization quality (used in academic NLP evaluation). It captures whether the candidate preserves the sequential structure of the baseline. Use when the output is a summary, a step-by-step explanation, or any text where the order of information matters.

**Sensitivity**: Sensitive to word order rearrangements. "Step 1: do A. Step 2: do B." vs. "Step 2: do B. Step 1: do A." scores lower on ROUGE-L than on Jaccard (same words, different order). Sensitive to insertions and deletions in the word sequence.

**Configuration**:

| Option | Type | Default | Description |
|---|---|---|---|
| `threshold` | `number` | `0.70` | Minimum ROUGE-L F1 to classify as neutral. |

**Default threshold**: 0.70. ROUGE-L scores tend to be lower than Jaccard for paraphrased outputs because word order changes reduce the LCS length.

---

### 6.4 BLEU

**Metric ID**: `'bleu'`

**What it measures**: The n-gram precision of the candidate output relative to the baseline. BLEU (Bilingual Evaluation Understudy) measures how many n-grams (contiguous word sequences of length 1-4) in the candidate appear in the baseline. It is the standard metric for machine translation evaluation and captures both vocabulary overlap (unigrams) and phrase-level overlap (bigrams, trigrams, 4-grams).

**Algorithm**:

1. Tokenize both strings into word sequences (lowercase).
2. For each n-gram size (1, 2, 3, 4):
   a. Extract all n-grams from both baseline and candidate.
   b. Compute clipped precision: for each candidate n-gram, count how many times it appears in the baseline (clipped to the baseline count). `precision_n = sum(clipped_counts) / sum(candidate_ngram_counts)`.
3. Compute the brevity penalty: `BP = exp(1 - baseline_length / candidate_length)` if `candidate_length < baseline_length`, else `BP = 1.0`. This penalizes candidates that are shorter than the baseline (they could achieve high precision by being very short).
4. Compute the geometric mean of n-gram precisions with uniform weights: `score = BP * exp(0.25 * sum(log(precision_n) for n in 1..4))`.
5. If any precision is 0, use smoothing: add epsilon (1e-10) to avoid log(0).

**Formula**: `BLEU = BP * exp(sum(w_n * log(p_n)) for n = 1..4)` where `w_n = 0.25`, `p_n` is the clipped n-gram precision for n-grams of size n, and `BP` is the brevity penalty.

**When to use**: When phrase-level precision matters. BLEU penalizes outputs that use different phrases even if the overall meaning is similar. It is stricter than Jaccard (which ignores word order within the phrase) and captures phrase-level patterns that ROUGE-L (which looks for the longest subsequence, not contiguous phrases) may miss.

**Sensitivity**: Highly sensitive to exact phrasing. Synonyms and paraphrases that change specific words within phrases reduce the score significantly. "The capital of France is Paris" vs. "France's capital city is Paris" scores lower on BLEU than on Jaccard because the bigrams and trigrams are different.

**Configuration**:

| Option | Type | Default | Description |
|---|---|---|---|
| `threshold` | `number` | `0.50` | Minimum BLEU score to classify as neutral. |
| `maxN` | `number` | `4` | Maximum n-gram size (1-4). |
| `weights` | `number[]` | `[0.25, 0.25, 0.25, 0.25]` | Weights for each n-gram size. |

**Default threshold**: 0.50. BLEU scores are naturally lower than other metrics for paraphrased LLM outputs because LLMs rarely produce identical phrases across runs. A BLEU score of 0.5 indicates substantial phrase-level overlap.

---

### 6.5 Exact Match

**Metric ID**: `'exact'`

**What it measures**: Whether the baseline and candidate outputs are identical strings. Binary: 1.0 if identical, 0.0 if any difference exists. No tolerance for any variation.

**Algorithm**:

1. Normalize both strings: optionally trim whitespace, optionally normalize Unicode.
2. Compare with `===`.
3. Score: 1.0 if identical, 0.0 otherwise.

**When to use**: For outputs that must be deterministic -- extracted IDs, fixed-format responses, enum values, error codes. Not suitable for free-text LLM outputs, which vary between runs even with the same prompt.

**Sensitivity**: Maximally sensitive. A single character difference produces a score of 0.0.

**Configuration**:

| Option | Type | Default | Description |
|---|---|---|---|
| `threshold` | `number` | `1.0` | Always 1.0 for exact match (binary metric). |
| `trim` | `boolean` | `true` | Trim leading/trailing whitespace before comparison. |
| `normalizeWhitespace` | `boolean` | `false` | Collapse multiple whitespace characters to single space. |
| `caseSensitive` | `boolean` | `true` | Whether comparison is case-sensitive. |

**Default threshold**: 1.0. Exact match is binary -- there is no meaningful threshold below 1.0.

---

### 6.6 Contains Match

**Metric ID**: `'contains'`

**What it measures**: Whether the candidate output contains all key phrases that were present in the baseline output. The baseline is split into phrases (sentences or user-provided substrings), and each is checked for presence in the candidate. This captures cases where the candidate includes all required information but adds, removes, or rearranges surrounding text.

**Algorithm**:

1. Determine key phrases: use `phrases` option if provided, otherwise split the baseline into sentences using rule-based sentence boundary detection.
2. For each phrase, check whether it appears in the candidate:
   a. If `caseSensitive`, use `candidate.includes(phrase)`.
   b. If `!caseSensitive`, use `candidate.toLowerCase().includes(phrase.toLowerCase())`.
3. `score = matchedPhrases / totalPhrases`.

**When to use**: When specific facts or phrases must be preserved in the candidate output, regardless of surrounding text. For factual QA where the answer must mention specific entities, dates, or values.

**Sensitivity**: Sensitive to the presence of specific substrings. Insensitive to surrounding text. "Paris is the capital of France, with a population of 2.1 million" contains the phrase "capital of France" but "The French capital city is Paris" does not (unless case-insensitive matching catches a substring).

**Configuration**:

| Option | Type | Default | Description |
|---|---|---|---|
| `threshold` | `number` | `1.0` | Minimum fraction of phrases that must be found. |
| `phrases` | `string[]` | Auto-extracted | Explicit list of required phrases. |
| `caseSensitive` | `boolean` | `false` | Whether phrase matching is case-sensitive. |

**Default threshold**: 1.0 (all phrases must be present).

---

### 6.7 Structural Match

**Metric ID**: `'structural'`

**What it measures**: Whether the baseline and candidate outputs have the same JSON structure -- same keys, same types, same nesting, same array lengths. Values are ignored; only the skeleton is compared. This catches cases where a prompt change alters the output format (adding/removing fields, changing types) even if the content is reasonable.

**Algorithm**:

1. Parse both values as JSON. If parsing fails, score 0.0.
2. Recursively walk both objects in parallel:
   a. For each key in the baseline, verify it exists in the candidate and has the same type.
   b. Check for extra keys in the candidate (fail if `allowExtraKeys: false`).
   c. For arrays: verify lengths match (if `checkArrayLength: true`), verify element types.
3. `score = matchedFields / totalFields`.

**When to use**: For structured (JSON) outputs where the schema must remain stable across prompt versions. Tool call responses, API-format outputs, classification results with specific fields.

**Sensitivity**: Sensitive to structural changes (added/removed keys, type changes). Insensitive to value changes.

**Configuration**:

| Option | Type | Default | Description |
|---|---|---|---|
| `threshold` | `number` | `1.0` | Minimum fraction of fields that must match. |
| `allowExtraKeys` | `boolean` | `false` | Whether the candidate may have keys not in the baseline. |
| `allowMissingKeys` | `boolean` | `false` | Whether the candidate may omit keys from the baseline. |
| `checkArrayLength` | `boolean` | `true` | Whether arrays must have the same length. |

**Default threshold**: 1.0 (perfect structural match required).

---

### 6.8 Custom Metric

**Metric ID**: `'custom'`

**What it measures**: Whatever the user's scoring function measures. The custom metric is the escape hatch for comparison logic that does not fit any built-in metric.

**Algorithm**:

1. Call the user-provided scoring function with the baseline and candidate strings.
2. The function returns a `CustomMetricResult` with `score` (0-1) and optional `details`.
3. Classification is determined by the score relative to the configured threshold.

**Signature**:

```typescript
type CustomMetricFn = (
  baseline: string,
  candidate: string,
) => CustomMetricResult | Promise<CustomMetricResult>;

interface CustomMetricResult {
  score: number;       // 0-1
  details?: string;    // human-readable explanation
}
```

**When to use**: When the built-in metrics do not capture the relevant dimension of similarity. Examples: domain-specific scoring (medical accuracy, legal precision), LLM-as-judge comparison (call an LLM to compare the two outputs), external API scoring, multi-dimensional scoring that combines several signals.

**Configuration**:

| Option | Type | Default | Description |
|---|---|---|---|
| `threshold` | `number` | `0.70` | Minimum score to classify as neutral. |
| `fn` | `CustomMetricFn` | Required | The scoring function. |

---

### Metric Summary

| Metric | Type | Speed | External Deps | Default Threshold | Best For |
|---|---|---|---|---|---|
| `semantic` | Continuous | 100-500ms | Embedding API | 0.85 | Meaning equivalence |
| `jaccard` | Continuous | < 2ms | None | 0.60 | Vocabulary overlap |
| `rouge-l` | Continuous | < 2ms | None | 0.70 | Sequential overlap |
| `bleu` | Continuous | < 2ms | None | 0.50 | Phrase-level precision |
| `exact` | Binary | < 0.1ms | None | 1.0 | Deterministic outputs |
| `contains` | Continuous | < 0.5ms | None | 1.0 | Key phrase preservation |
| `structural` | Continuous | < 1ms | None | 1.0 | JSON format stability |
| `custom` | User-defined | User-defined | User-defined | 0.70 | Domain-specific |

---

## 7. Regression Classification

### Per-Comparison Classification

Each comparison between a baseline output and a candidate output is classified based on the similarity score(s) relative to the configured threshold(s):

**Regression**: A comparison is classified as a regression when the primary metric score is below the regression threshold. This means the candidate output is significantly worse than the baseline on the measured dimension. When multiple metrics are active, a comparison is classified as a regression if any metric's score falls below its threshold (configurable to require all metrics to fail, or any single metric to fail -- controlled by `classificationMode`).

**Improvement**: A comparison is classified as an improvement when:
1. A `groundTruth` reference is provided, and the candidate output scores higher on quality metrics against the ground truth than the baseline does, OR
2. The candidate output scores above the improvement threshold (default: baseline score + 0.10 on the quality metric, indicating the candidate is measurably better).

Improvement detection is optional and requires either a ground truth reference or a quality metric (such as a custom metric that evaluates absolute quality). Without these, all non-regression comparisons are classified as neutral.

**Neutral**: A comparison is classified as neutral when the similarity score meets or exceeds the threshold (no regression detected) and does not meet the improvement criteria. The output changed within acceptable bounds.

### Multi-Metric Classification

When multiple metrics are requested for each comparison, classification uses one of two modes:

**`'any'` mode (default)**: A comparison is classified as a regression if any single metric's score falls below its threshold. This is conservative -- any metric regression triggers a failure. Use when all metrics represent important quality dimensions that must all be maintained.

**`'all'` mode**: A comparison is classified as a regression only if all metrics' scores fall below their thresholds. This is permissive -- only a universal regression triggers a failure. Use when metrics capture redundant signals and a failure on one is acceptable if others pass.

**Weighted composite**: When `compositeWeight` is configured, metric scores are combined into a single composite score using the specified weights, and classification is based on the composite score relative to the composite threshold. This enables "the overall quality must be above X, even if one individual metric dips."

```typescript
compareBatch(testCases, {
  metrics: ['semantic', 'jaccard', 'rouge-l'],
  compositeWeights: { semantic: 0.5, jaccard: 0.3, 'rouge-l': 0.2 },
  compositeThreshold: 0.75,
});
```

### Aggregate Classification

After all test cases are compared and individually classified, the aggregate classification determines the overall pass/fail result:

- **Pass**: `passRate >= aggregateThreshold` where `passRate = (neutral + improvements) / total`.
- **Fail**: `passRate < aggregateThreshold`.

The aggregate threshold defaults to 0.90 (90% of test cases must pass). This allows a small fraction of regressions without failing the entire test -- useful when LLM outputs have natural run-to-run variation that occasionally dips below the threshold.

### Classification Example

Given 10 test cases compared with semantic similarity (threshold 0.85), aggregate threshold 0.90:

```
Test 1:  score 0.95  → neutral
Test 2:  score 0.88  → neutral
Test 3:  score 0.72  → REGRESSION (below 0.85)
Test 4:  score 0.91  → neutral
Test 5:  score 0.97  → neutral
Test 6:  score 0.85  → neutral (exactly at threshold)
Test 7:  score 0.93  → neutral
Test 8:  score 0.89  → neutral
Test 9:  score 0.86  → neutral
Test 10: score 0.94  → neutral

Pass rate: 9/10 = 0.90 → PASS (meets aggregate threshold of 0.90)
Regressions: 1 (Test 3)
```

---

## 8. Side-by-Side Output

### Terminal Format

Colored terminal output for human review during development and local testing. Shows each comparison with the baseline and candidate outputs side by side, the similarity score with a visual gauge, and the classification.

```
llm-regression: 10 test cases, 1 metric (jaccard)

  ✓ capital       0.86 [═════════>─────] neutral
  ✓ math          0.72 [═══════>───────] neutral
  ✗ ambiguous     0.41 [════>──────────] REGRESSION
  ✓ long-form     0.78 [════════>──────] neutral
  ✓ empty         1.00 [═══════════════] neutral

  ── REGRESSION: ambiguous ──────────────────────────────
  Baseline:
    "Mercury is the closest planet to the Sun in our solar system."
  Candidate:
    "Mercury is a chemical element with the symbol Hg."

  Scores: jaccard=0.41 (threshold: 0.60)
  ─────────────────────────────────────────────────────────

Summary: 4 neutral, 0 improvements, 1 regression
Pass rate: 80% (threshold: 90%) → FAIL
```

Terminal colors follow standard conventions: green for passing, red for regression, yellow for warnings, cyan for scores, bold for headings. Colors are disabled when `NO_COLOR` is set, stdout is not a TTY, or `--no-color` is passed.

### JSON Format

Structured JSON output for programmatic consumption, CI integration, and downstream processing.

```json
{
  "summary": {
    "total": 10,
    "neutral": 9,
    "improvements": 0,
    "regressions": 1,
    "passRate": 0.90,
    "passed": true
  },
  "metrics": ["jaccard"],
  "thresholds": { "jaccard": 0.60 },
  "aggregateThreshold": 0.90,
  "results": [
    {
      "testId": "capital",
      "baseline": "Paris is the capital of France.",
      "candidate": "The capital of France is Paris.",
      "scores": { "jaccard": 0.857 },
      "classification": "neutral"
    }
  ],
  "regressions": [
    {
      "testId": "ambiguous",
      "baseline": "Mercury is the closest planet to the Sun.",
      "candidate": "Mercury is a chemical element with symbol Hg.",
      "scores": { "jaccard": 0.41 },
      "classification": "regression"
    }
  ],
  "aggregateScores": {
    "jaccard": { "mean": 0.82, "median": 0.86, "min": 0.41, "max": 1.0, "stddev": 0.16 }
  },
  "timestamp": "2026-03-18T12:00:00.000Z",
  "durationMs": 245
}
```

### Markdown Format

Markdown output designed for posting as a PR comment on GitHub or GitLab. Provides a summary table and details for regressions.

```markdown
## Regression Test Results

**Status**: FAIL -- 1 regression detected

| Test Case | Jaccard | Classification |
|---|---|---|
| capital | 0.86 | neutral |
| math | 0.72 | neutral |
| ambiguous | **0.41** | **REGRESSION** |
| long-form | 0.78 | neutral |
| empty | 1.00 | neutral |

### Regressions

<details>
<summary>ambiguous (jaccard: 0.41, threshold: 0.60)</summary>

**Baseline**:
> Mercury is the closest planet to the Sun in our solar system.

**Candidate**:
> Mercury is a chemical element with the symbol Hg.

</details>

**Pass rate**: 80% (threshold: 90%)
**Metrics**: jaccard (threshold: 0.60)
```

### HTML Format

Self-contained HTML file with an interactive comparison view. Each test case is displayed as a collapsible row with side-by-side baseline and candidate outputs. Scores are color-coded. Regressions are highlighted and expanded by default.

The HTML output is a single file with inline CSS and JavaScript (no external dependencies), suitable for opening in a browser, attaching to a CI artifact, or hosting on a static file server. It uses standard HTML/CSS only -- no framework dependencies.

### Format Selection

Output format is controlled by the `format` option on `compareBatch` and `runRegression`, or the `--format` flag on the CLI:

```typescript
const report = await compareBatch(testCases, { format: 'markdown' });
console.log(report.formatted); // Markdown string
```

```bash
llm-regression --format json --config regression.json
```

---

## 9. API Surface

### 9.1 Installation

```bash
npm install llm-regression
```

### 9.2 Core Functions

#### `compare`

```typescript
import { compare } from 'llm-regression';

const result = await compare(baseline, candidate, options?);
```

Compares two LLM outputs and returns a `ComparisonResult`. This is the lowest-level API -- one baseline string vs. one candidate string.

**Parameters**:

- `baseline: string` -- the reference output (from the current prompt version).
- `candidate: string` -- the new output (from the modified prompt version).
- `options?: CompareOptions` -- metric selection, thresholds, embedder, formatting.

**Returns**: `Promise<ComparisonResult>`.

**Example**:

```typescript
import { compare } from 'llm-regression';

const result = await compare(
  'Paris is the capital of France.',
  'The capital of France is Paris.',
  { metric: 'jaccard' },
);

console.log(result.score);           // 0.857
console.log(result.classification);  // 'neutral'
```

#### `compareBatch`

```typescript
import { compareBatch } from 'llm-regression';

const report = await compareBatch(testCases, options?);
```

Compares an array of baseline/candidate pairs. Returns a `BatchReport` with per-case results and aggregate statistics.

**Parameters**:

- `testCases: TestCase[]` -- array of `{ id?, input?, baseline, candidate, metadata?, thresholds? }`.
- `options?: BatchOptions` -- metrics, thresholds, format, aggregate threshold, concurrency.

**Returns**: `Promise<BatchReport>`.

**Example**:

```typescript
import { compareBatch } from 'llm-regression';

const report = await compareBatch([
  { id: 'q1', baseline: 'Paris is the capital of France.', candidate: 'The capital of France is Paris.' },
  { id: 'q2', baseline: '2 + 2 equals 4.', candidate: 'The answer is 4.' },
], {
  metrics: ['jaccard', 'rouge-l'],
  thresholds: { jaccard: 0.60, 'rouge-l': 0.65 },
  aggregateThreshold: 0.90,
});

console.log(report.summary.passRate);  // 1.0
console.log(report.summary.passed);    // true
```

#### `runRegression`

```typescript
import { runRegression } from 'llm-regression';

const report = await runRegression(testInputs, baselinePrompt, candidatePrompt, llmFn, options?);
```

End-to-end regression testing: run both prompts against all test inputs using the LLM function, compare all outputs, return a full regression report. This is the highest-level API.

**Parameters**:

- `testInputs: TestInput[]` -- array of `{ id?, input, metadata?, thresholds? }`.
- `baselinePrompt: string` -- the current prompt template. The LLM function receives `baselinePrompt + input`.
- `candidatePrompt: string` -- the new prompt template.
- `llmFn: LlmFn` -- `(prompt: string) => Promise<string>`. User-provided function that calls the LLM.
- `options?: RegressionOptions` -- metrics, thresholds, format, concurrency, prompt composition function.

**Returns**: `Promise<RegressionReport>`.

**Example**:

```typescript
import { runRegression } from 'llm-regression';
import OpenAI from 'openai';

const openai = new OpenAI();
const llm = async (prompt: string) => {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
  });
  return res.choices[0].message.content ?? '';
};

const report = await runRegression(
  [
    { id: 'capital', input: 'What is the capital of France?' },
    { id: 'math',    input: 'What is 2 + 2?' },
  ],
  'Answer the following question concisely:\n',           // baseline prompt
  'Answer the following question in one sentence:\n',     // candidate prompt
  llm,
  { metrics: ['jaccard', 'rouge-l'], aggregateThreshold: 0.90 },
);

if (!report.summary.passed) {
  console.error('Regressions detected:', report.regressions);
  process.exit(1);
}
```

#### `createRegression`

```typescript
import { createRegression } from 'llm-regression';

const tester = createRegression(config);
```

Creates a pre-configured `RegressionTester` instance. Use this to avoid repeating configuration across test files.

**Parameters**:

- `config: RegressionConfig` -- default metrics, thresholds, embedder, format, aggregate threshold, LLM function.

**Returns**: `RegressionTester`.

**Example**:

```typescript
import { createRegression } from 'llm-regression';

const tester = createRegression({
  metrics: ['semantic', 'jaccard'],
  thresholds: { semantic: 0.85, jaccard: 0.60 },
  aggregateThreshold: 0.95,
  embedFn: myEmbedFn,
});

// Use the pre-configured instance
const result = await tester.compare(baseline, candidate);
const report = await tester.compareBatch(testCases);
const regression = await tester.runRegression(inputs, basePrompt, newPrompt, llmFn);
```

### 9.3 Type Definitions

```typescript
// ── Input Types ──────────────────────────────────────────────────────

/** A single test case with pre-generated baseline and candidate outputs. */
interface TestCase {
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
interface TestInput {
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
type MetricId = 'semantic' | 'jaccard' | 'rouge-l' | 'bleu' | 'exact' | 'contains' | 'structural' | 'custom';

/** Per-metric threshold configuration. */
type MetricThresholds = Partial<Record<MetricId, number>>;

/** Scores from all requested metrics for one comparison. */
type MetricScores = Partial<Record<MetricId, number>>;

/** User-provided embedding function for semantic similarity. */
type EmbedFn = (text: string) => Promise<number[]>;

/** User-provided LLM function for generating outputs. */
type LlmFn = (prompt: string) => Promise<string>;

/** User-provided scoring function for custom metrics. */
type CustomMetricFn = (
  baseline: string,
  candidate: string,
) => CustomMetricResult | Promise<CustomMetricResult>;

interface CustomMetricResult {
  /** Similarity score in [0, 1]. */
  score: number;

  /** Optional human-readable explanation. */
  details?: string;
}

// ── Comparison Classification ────────────────────────────────────────

/** How a comparison is classified. */
type Classification = 'regression' | 'improvement' | 'neutral';

/** How multi-metric classification aggregates. */
type ClassificationMode = 'any' | 'all';

// ── Result Types ─────────────────────────────────────────────────────

/** Result of comparing one baseline/candidate pair. */
interface ComparisonResult {
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
interface MetricStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  stddev: number;
  passRate: number;
}

/** Summary of a batch comparison. */
interface BatchSummary {
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
interface BatchReport {
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
interface RegressionReport extends BatchReport {
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
interface CompareOptions {
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
interface BatchOptions extends CompareOptions {
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
interface RegressionOptions extends BatchOptions {
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
interface RegressionConfig {
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
interface RegressionTester {
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
```

---

## 10. Baseline Management

### File-Based Baselines

Baselines are JSON files that store the outputs from a reference prompt version. They are committed to version control alongside the prompt templates, providing a reproducible reference for regression testing.

### `saveBaseline`

```typescript
import { saveBaseline } from 'llm-regression';

await saveBaseline(results, './baselines/v1.2.0.json');
```

Saves an array of `{ id, output }` objects to a JSON file. The file format includes metadata (timestamp, prompt version, model used) for traceability.

**Parameters**:

- `results: BaselineEntry[]` -- array of `{ id: string; output: string; input?: string; metadata?: Record<string, unknown> }`.
- `path: string` -- file path to write. Parent directories are created if they do not exist.
- `options?: SaveBaselineOptions` -- optional metadata to include (prompt version, model name, timestamp).

**File format**:

```json
{
  "__meta": {
    "version": 1,
    "createdAt": "2026-03-18T12:00:00.000Z",
    "promptVersion": "v1.2.0",
    "model": "gpt-4o-mini"
  },
  "entries": [
    { "id": "capital", "input": "What is the capital of France?", "output": "Paris is the capital of France." },
    { "id": "math", "input": "What is 2 + 2?", "output": "2 + 2 equals 4." }
  ]
}
```

### `loadBaseline`

```typescript
import { loadBaseline } from 'llm-regression';

const baseline = await loadBaseline('./baselines/v1.2.0.json');
```

Reads a baseline file and returns the entries.

**Parameters**:

- `path: string` -- file path to read.

**Returns**: `Promise<BaselineFile>` containing `meta` and `entries`.

**Error handling**: If the file does not exist, throws with a descriptive message. If the file is corrupt (invalid JSON), throws with the parse error and file path.

### Baseline Workflow

The recommended workflow for baseline management:

1. **Create baseline**: Run the prompt against all test inputs, save outputs to a baseline file.
   ```typescript
   const outputs = await Promise.all(inputs.map(i => llm(prompt + i.input)));
   const entries = inputs.map((i, idx) => ({ id: i.id, input: i.input, output: outputs[idx] }));
   await saveBaseline(entries, `./baselines/${version}.json`);
   ```

2. **Commit baseline**: Add the baseline file to version control. It lives alongside the prompt template.

3. **Regression test**: On prompt change, load the stored baseline and compare against new outputs.
   ```typescript
   const baseline = await loadBaseline('./baselines/v1.2.0.json');
   const testCases = baseline.entries.map(e => ({
     id: e.id,
     input: e.input,
     baseline: e.output,
     candidate: newOutputs[e.id],
   }));
   const report = await compareBatch(testCases);
   ```

4. **Update baseline**: After accepting a prompt change, regenerate and save a new baseline.
   ```typescript
   await saveBaseline(newEntries, `./baselines/${newVersion}.json`);
   ```

### Baseline Versioning

Baselines should be versioned alongside the prompt they represent. Naming convention: `baselines/<prompt-name>/<version>.json`. When a prompt version is bumped, the baseline file for the new version is created. Old baselines are kept for historical comparison.

---

## 11. Threshold Configuration

### Global Threshold

The global threshold applies to all comparisons that do not have a more specific threshold override. It is set on the options object or the `createRegression` config:

```typescript
compareBatch(testCases, {
  metric: 'jaccard',
  thresholds: { jaccard: 0.65 },
});
```

### Default Thresholds by Metric

Each metric has a default threshold tuned for typical LLM output variation:

| Metric | Default Threshold | Rationale |
|---|---|---|
| `semantic` | 0.85 | Cosine similarity above 0.85 indicates strong semantic equivalence. |
| `jaccard` | 0.60 | Jaccard is coarser; identical-meaning outputs often score 0.5-0.8. |
| `rouge-l` | 0.70 | ROUGE-L captures sequential overlap; paraphrases score 0.6-0.8. |
| `bleu` | 0.50 | BLEU is strict on exact phrases; paraphrased LLM outputs score 0.3-0.6. |
| `exact` | 1.0 | Binary metric; only exact match passes. |
| `contains` | 1.0 | All key phrases must be present by default. |
| `structural` | 1.0 | Perfect structural match required by default. |
| `custom` | 0.70 | Reasonable default for user-defined scoring. |

### Per-Metric Thresholds

Override the default threshold for specific metrics:

```typescript
compareBatch(testCases, {
  metrics: ['semantic', 'jaccard'],
  thresholds: {
    semantic: 0.90,   // stricter than default
    jaccard: 0.50,    // more lenient than default
  },
});
```

### Per-Test-Case Thresholds

Override thresholds for specific test cases. This enables stricter matching for critical test cases and more lenient matching for cases with expected high variation:

```typescript
const testCases: TestCase[] = [
  {
    id: 'critical-fact',
    baseline: 'The speed of light is 299,792,458 m/s.',
    candidate: 'Light travels at approximately 300,000 km/s.',
    thresholds: { semantic: 0.95 },  // strict: factual content must match closely
  },
  {
    id: 'creative-writing',
    baseline: 'Once upon a time in a faraway land...',
    candidate: 'In a distant kingdom, long ago...',
    thresholds: { semantic: 0.70 },  // lenient: creative text can vary widely
  },
];
```

### Aggregate Threshold

The aggregate threshold controls the overall pass/fail determination. It specifies the minimum fraction of test cases that must pass:

```typescript
compareBatch(testCases, {
  aggregateThreshold: 0.95,  // 95% of test cases must pass
});
```

**Default**: 0.90 (90% of test cases must pass).

Setting `aggregateThreshold: 1.0` requires all test cases to pass (zero tolerance for regressions). Setting `aggregateThreshold: 0.80` allows up to 20% of test cases to regress.

### Threshold Resolution Order

When multiple threshold sources exist, they are resolved from most specific to least specific:

1. Per-test-case threshold (highest priority).
2. Per-call `thresholds` option.
3. `createRegression(config).thresholds`.
4. Metric default threshold (lowest priority).

---

## 12. CI Integration

### Exit Codes

The CLI and the programmatic API produce deterministic exit codes for CI integration:

| Code | Meaning |
|---|---|
| 0 | No regressions detected. Pass rate meets the aggregate threshold. |
| 1 | Regressions detected. Pass rate is below the aggregate threshold. |
| 2 | Configuration or usage error (invalid config file, missing required options). |

### GitHub Actions

Example workflow step that runs regression tests and posts a PR comment:

```yaml
- name: Run prompt regression tests
  run: npx llm-regression --config regression.json --format json > report.json
  continue-on-error: true

- name: Post regression report
  if: github.event_name == 'pull_request'
  uses: actions/github-script@v7
  with:
    script: |
      const fs = require('fs');
      const report = JSON.parse(fs.readFileSync('report.json', 'utf-8'));
      const body = `## Prompt Regression Test\n\n` +
        `**Status**: ${report.summary.passed ? 'PASS' : 'FAIL'}\n` +
        `**Pass rate**: ${(report.summary.passRate * 100).toFixed(1)}%\n` +
        `**Regressions**: ${report.summary.regressions}\n`;
      await github.rest.issues.createComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        issue_number: context.issue.number,
        body,
      });
```

### Markdown Report for PR Comments

The `--format markdown` output is designed for direct inclusion in PR comments:

```bash
npx llm-regression --config regression.json --format markdown > report.md
```

The Markdown output includes a summary table, per-test-case results, and collapsible details for regressions.

### Baseline Comparison Workflow

A common CI pattern: compare new outputs against a stored baseline committed to the repository.

```yaml
- name: Generate candidate outputs
  run: node scripts/generate-outputs.js > candidate.json

- name: Run regression comparison
  run: |
    npx llm-regression compare \
      --baseline baselines/v1.2.0.json \
      --candidate candidate.json \
      --metric jaccard \
      --threshold 0.60 \
      --aggregate-threshold 0.90 \
      --format json
```

### Programmatic CI Integration

For test suites that use Vitest or Jest, use the programmatic API inside test files:

```typescript
import { describe, it, expect } from 'vitest';
import { compareBatch, loadBaseline } from 'llm-regression';

describe('prompt regression', () => {
  it('should not regress on v2 prompt changes', async () => {
    const baseline = await loadBaseline('./baselines/v1.2.0.json');
    const newOutputs = await generateCandidateOutputs();

    const testCases = baseline.entries.map(entry => ({
      id: entry.id,
      baseline: entry.output,
      candidate: newOutputs[entry.id],
    }));

    const report = await compareBatch(testCases, {
      metrics: ['jaccard', 'rouge-l'],
      aggregateThreshold: 0.95,
    });

    expect(report.summary.passed).toBe(true);
    if (!report.summary.passed) {
      console.error(report.formatted);
    }
  });
});
```

---

## 13. Configuration

### Programmatic Configuration

All configuration is done through typed options objects passed to API functions or the `createRegression` factory. There is no configuration file for the programmatic API -- configuration lives in the code.

### CLI Configuration File

The CLI reads configuration from a JSON file:

```json
{
  "testCases": "./test-cases.json",
  "baseline": "./baselines/v1.2.0.json",
  "metrics": ["jaccard", "rouge-l"],
  "thresholds": {
    "jaccard": 0.60,
    "rouge-l": 0.65
  },
  "aggregateThreshold": 0.90,
  "format": "terminal"
}
```

### Configuration Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `metric` | `MetricId` | `'jaccard'` | Primary similarity metric. |
| `metrics` | `MetricId[]` | `['jaccard']` | Multiple metrics (overrides `metric`). |
| `thresholds` | `MetricThresholds` | Metric defaults | Per-metric similarity thresholds. |
| `aggregateThreshold` | `number` | `0.90` | Minimum pass rate for overall pass. |
| `classificationMode` | `'any' \| 'all'` | `'any'` | Multi-metric classification mode. |
| `compositeWeights` | `Record<MetricId, number>` | -- | Weights for composite scoring. |
| `compositeThreshold` | `number` | -- | Threshold for composite score. |
| `format` | `string` | `'terminal'` | Output format: terminal, json, markdown, html. |
| `concurrency` | `number` | `10` | Concurrency limit for comparisons. |
| `llmConcurrency` | `number` | `5` | Concurrency limit for LLM calls (runRegression). |
| `embedFn` | `EmbedFn` | -- | Embedding function for semantic metric. |
| `customMetricFn` | `CustomMetricFn` | -- | Scoring function for custom metric. |
| `composePrompt` | `Function` | `(p, i) => p + i` | Prompt composition for runRegression. |

### Configuration Precedence

Options are resolved in order of specificity:

1. Per-test-case overrides (highest priority).
2. Per-call options.
3. `createRegression(config)` instance defaults.
4. Built-in defaults (lowest priority).

---

## 14. CLI

### Installation and Invocation

```bash
# Global install
npm install -g llm-regression

# npx (no install)
npx llm-regression --config regression.json

# Package script
# package.json: { "scripts": { "regression": "llm-regression --config regression.json" } }
npm run regression
```

### CLI Binary Name

`llm-regression`

### Commands

**`llm-regression run` (default)**

Run regression tests from a configuration file.

```bash
llm-regression --config regression.json
llm-regression --config regression.json --format markdown
llm-regression --config regression.json --format json > report.json
```

**Flags**:

| Flag | Alias | Type | Default | Description |
|---|---|---|---|---|
| `--config` | `-c` | `string` | Required | Path to configuration JSON file. |
| `--format` | `-f` | `string` | `'terminal'` | Output format: terminal, json, markdown, html. |
| `--metric` | `-m` | `string` | `'jaccard'` | Similarity metric (overridden by config file). |
| `--threshold` | `-t` | `number` | Metric default | Threshold for primary metric. |
| `--aggregate-threshold` | | `number` | `0.90` | Aggregate pass rate threshold. |
| `--baseline` | `-b` | `string` | -- | Path to baseline file (overrides config). |
| `--candidate` | | `string` | -- | Path to candidate outputs file. |
| `--no-color` | | `boolean` | `false` | Disable terminal colors. |
| `--quiet` | `-q` | `boolean` | `false` | Suppress output; exit code only. |
| `--verbose` | `-v` | `boolean` | `false` | Show detailed per-test-case output. |

**`llm-regression compare`**

Compare two individual outputs (useful for quick ad-hoc checks).

```bash
llm-regression compare --baseline "Paris is the capital of France." --candidate "The capital of France is Paris." --metric jaccard
```

**`llm-regression baseline`**

Manage baseline files.

```bash
# Show baseline file contents
llm-regression baseline show ./baselines/v1.2.0.json

# Validate baseline file format
llm-regression baseline validate ./baselines/v1.2.0.json
```

### Exit Codes

| Code | Meaning |
|---|---|
| 0 | No regressions detected (or successful baseline command). |
| 1 | Regressions detected (pass rate below threshold). |
| 2 | Configuration or usage error. |

---

## 15. Integration with the npm-master Ecosystem

### prompt-snap

`prompt-snap` provides snapshot testing (comparing one output against a stored reference). `llm-regression` provides version comparison (comparing outputs from two prompt versions against each other). The two are complementary:

- Use `prompt-snap` when you want to know "did the output change too much from what we stored?"
- Use `llm-regression` when you want to know "is prompt v2 better or worse than prompt v1 across a test set?"

Integration: use `prompt-snap` for individual assertion-style tests in test files, and `llm-regression` for batch version-comparison tests that run as a CI gate.

### prompt-diff

`prompt-diff` computes diffs between prompt template texts. `llm-regression` computes diffs between the outputs those prompts produce. Together they answer: "what changed in the prompt?" (prompt-diff) and "what effect did that change have on outputs?" (llm-regression).

```typescript
import { diffPrompts } from 'prompt-diff';
import { runRegression } from 'llm-regression';

// See what changed in the prompt
const promptDiff = diffPrompts(oldPrompt, newPrompt);
console.log(promptDiff);

// See what effect it had on outputs
const report = await runRegression(testInputs, oldPrompt, newPrompt, llmFn);
console.log(report.formatted);
```

### prompt-version

`prompt-version` manages prompt template versioning. Use it to track which prompt version is baseline and which is candidate:

```typescript
import { getPrompt } from 'prompt-version';
import { runRegression } from 'llm-regression';

const baseline = getPrompt('chatbot', 'v1.2.0');
const candidate = getPrompt('chatbot', 'v1.3.0');

const report = await runRegression(testInputs, baseline, candidate, llmFn);
```

### llm-vcr

`llm-vcr` records and replays LLM API calls for deterministic testing. Use it with `llm-regression` to make regression tests deterministic:

```typescript
import { withCassette } from 'llm-vcr';
import { runRegression } from 'llm-regression';

await withCassette('regression-v1.3', async () => {
  // First run: records LLM calls. Subsequent runs: replays them.
  const report = await runRegression(testInputs, baselinePrompt, candidatePrompt, llmFn);
  expect(report.summary.passed).toBe(true);
});
```

This combination is powerful for CI: the first run records real LLM responses, subsequent runs replay them. The regression test is fast, deterministic, and free of LLM API costs after the initial recording.

### llm-cost-per-test

`llm-cost-per-test` tracks the cost of LLM calls in test suites. `llm-regression`'s `runRegression` generates LLM calls (running both prompts against all inputs). Wrap the LLM function with `llm-cost-per-test` to track and report costs:

```typescript
import { trackCost } from 'llm-cost-per-test';
import { runRegression } from 'llm-regression';

const { llmFn: trackedLlm, getCost } = trackCost(llmFn, { model: 'gpt-4o-mini' });

const report = await runRegression(testInputs, baselinePrompt, candidatePrompt, trackedLlm);
console.log(`Regression test cost: $${getCost().total.toFixed(4)}`);
```

### output-grade

`output-grade` scores LLM output quality with zero-cost heuristics. Use it as a custom metric in `llm-regression` to detect quality regressions that similarity metrics miss:

```typescript
import { grade } from 'output-grade';
import { compareBatch } from 'llm-regression';

const report = await compareBatch(testCases, {
  metrics: ['jaccard', 'custom'],
  customMetricFn: (baseline, candidate) => {
    const baselineGrade = grade(baseline);
    const candidateGrade = grade(candidate);
    // Regression if candidate quality is significantly lower than baseline
    const score = Math.min(1.0, candidateGrade.score / Math.max(baselineGrade.score, 0.01));
    return { score, details: `Baseline quality: ${baselineGrade.score}, Candidate quality: ${candidateGrade.score}` };
  },
});
```

---

## 16. Testing Strategy

### Unit Tests

Each similarity metric has its own test suite:

**Jaccard metric tests**:
- Identical strings: score 1.0.
- Completely different strings: score 0.0.
- Same words, different order: score 1.0 (Jaccard is order-independent).
- Partial overlap: proportional score (verified against hand-calculated expectation).
- Stopword removal: stopwords do not inflate similarity score.
- Case sensitivity: insensitive by default; sensitive when configured.
- Empty strings: score 0.0.
- Threshold boundary: score exactly at threshold passes, score below fails.

**ROUGE-L metric tests**:
- Identical sequences: score 1.0.
- Completely different sequences: score 0.0.
- Subsequence present: score proportional to LCS length.
- Word order matters: reversed sequences score lower than original.
- One string is a substring of the other: recall and precision asymmetry.
- Empty strings: score 0.0.

**BLEU metric tests**:
- Identical strings: score close to 1.0.
- Completely different strings: score 0.0 (with smoothing, near 0).
- Brevity penalty: short candidate penalized relative to long baseline.
- N-gram precision: verified against hand-calculated values for small examples.
- Smoothing: handles zero-precision n-gram levels gracefully.

**Exact metric tests**:
- Identical strings: score 1.0.
- Different strings: score 0.0.
- Whitespace trimming: trailing spaces ignored when `trim: true`.
- Case sensitivity: respects configuration.
- Whitespace normalization: multiple spaces collapsed when configured.

**Contains metric tests**:
- All phrases present: score 1.0.
- Some phrases missing: proportional score.
- Case sensitivity: insensitive by default.
- Custom phrase list: user-provided phrases checked.
- Empty phrase list: score 1.0 (vacuously true).
- Empty candidate: score 0.0 if any phrases expected.

**Structural metric tests**:
- Identical JSON: score 1.0.
- Same keys, different values: score 1.0 (values ignored).
- Missing key: score reduced, reported in diff.
- Extra key: fail when `allowExtraKeys: false`, pass when true.
- Type mismatch: fail, reported.
- Nested objects: recursive check.
- Arrays: same length vs. different length, element type checking.
- Non-JSON input: score 0.0.

**Custom metric tests**:
- Sync function: called correctly, score returned.
- Async function: awaited correctly.
- Function throws: comparison fails with error.
- Score validation: scores outside [0, 1] clamped.

**Semantic metric tests** (with mock embedder):
- Identical texts: score 1.0 (identical embeddings).
- Orthogonal embeddings: score 0.0.
- Similar embeddings (above threshold): pass.
- Dissimilar embeddings (below threshold): fail.
- Embedder throws: comparison fails with error.
- Embedder returns zero vector: comparison fails with error.

### Classification Tests

- Score above threshold: classified as neutral.
- Score below threshold: classified as regression.
- Score with ground truth where candidate is closer: classified as improvement.
- Multi-metric `'any'` mode: one metric below threshold triggers regression.
- Multi-metric `'all'` mode: all metrics must be below threshold for regression.
- Composite scoring: weighted average compared against composite threshold.

### Batch Report Tests

- All test cases neutral: summary shows 100% pass rate, `passed: true`.
- Some regressions, above aggregate threshold: `passed: true`, regressions listed.
- Regressions below aggregate threshold: `passed: false`.
- Aggregate statistics: mean, median, min, max, stddev verified against manual calculation.
- Empty test case array: report with zero results, `passed: true`.
- Single test case: report with one result.

### Baseline Management Tests

- `saveBaseline`: creates file with correct format, creates parent directories.
- `loadBaseline`: reads and parses file correctly.
- `loadBaseline` with non-existent file: throws with descriptive message.
- `loadBaseline` with corrupt file: throws with parse error.
- Round-trip: save then load returns identical entries.
- Metadata preserved: prompt version, model, timestamp stored and retrieved.

### Output Format Tests

- Terminal format: correct color codes, regression highlighted, scores formatted.
- JSON format: valid JSON, matches `BatchReport` schema.
- Markdown format: valid Markdown, table structure, collapsible regression details.
- HTML format: valid HTML, self-contained (no external dependencies).
- `NO_COLOR` support: terminal format without color codes.

### Integration Tests

- End-to-end `compare`: two strings in, `ComparisonResult` out, classification correct.
- End-to-end `compareBatch`: array of test cases in, `BatchReport` out, pass/fail correct.
- End-to-end `runRegression` with mock LLM: test inputs in, both prompts called, outputs compared, `RegressionReport` out.
- `createRegression` factory: instance created with config, methods work with defaults.
- CI integration: CLI exits with correct code for pass and fail scenarios.

### Edge Cases

- Very long outputs (100KB+): comparison completes without timeout.
- Unicode and emoji in outputs: all metrics handle correctly.
- Outputs with only whitespace: handled gracefully.
- Outputs with special characters (JSON special chars, regex special chars): no crashes.
- Concurrent comparisons: no race conditions in batch processing.
- All test cases are regressions: pass rate 0%, `passed: false`.
- All test cases are improvements: pass rate 100%, `passed: true`.

### Test Framework

Tests use Vitest, matching the project's existing `vitest run` configuration in `package.json`.

---

## 17. Performance

### Metric Computation Performance

| Metric | Expected Latency | Notes |
|---|---|---|
| `exact` | < 0.1ms | String comparison, O(n) in string length. |
| `contains` | < 0.5ms | Substring search per phrase, O(p * n). |
| `jaccard` | < 2ms | Tokenization + set operations, O(n) in word count. |
| `rouge-l` | < 5ms | LCS dynamic programming, O(m * n) in word counts. |
| `bleu` | < 3ms | N-gram extraction + precision calculation, O(n * maxN). |
| `structural` | < 1ms | Recursive object traversal, O(k) in total fields. |
| `semantic` | 100-500ms | Dominated by embedding API round-trip. |
| `custom` | User-defined | Depends on the scoring function. |

### Batch Processing

`compareBatch` processes test cases with configurable concurrency (default: 10). For lexical metrics (no API calls), the comparison engine is CPU-bound and processes thousands of test cases per second. For semantic metrics, the bottleneck is the embedding API; concurrency is limited by API rate limits.

**Benchmarks** (approximate, on a modern machine):

| Test Suite Size | Metric | Expected Duration |
|---|---|---|
| 100 test cases | jaccard | < 200ms |
| 100 test cases | rouge-l | < 500ms |
| 100 test cases | semantic | 10-50s (API-dependent) |
| 1000 test cases | jaccard | < 2s |
| 1000 test cases | rouge-l | < 5s |

### LLM Call Performance (runRegression)

`runRegression` makes `2 * n` LLM calls (n for baseline, n for candidate). With `llmConcurrency: 5` (default), the generation phase takes approximately `(2n / 5) * latency_per_call`. For 50 test inputs at 500ms per call: `(100 / 5) * 500ms = 10 seconds`.

### Memory

Comparison results are held in memory for the duration of the batch. Each `ComparisonResult` is lightweight (strings + scores). For 10,000 test cases with average 500-byte outputs, memory usage is approximately 10MB. The ROUGE-L LCS matrix is the largest per-comparison allocation: `O(m * n)` where m and n are word counts. For 1000-word outputs, the matrix is ~4MB. This is allocated and freed per comparison.

---

## 18. Dependencies

### Runtime Dependencies

None. All lexical metrics (Jaccard, ROUGE-L, BLEU, exact, contains, structural) are implemented from scratch using built-in JavaScript APIs. No external packages at runtime.

### Peer Dependencies (Optional)

None. The semantic metric requires a user-provided `embedFn`, but no specific embedding library is a peer dependency. Users choose their own embedding provider.

### Development Dependencies

| Package | Purpose |
|---|---|
| `typescript` | TypeScript compiler. |
| `vitest` | Test runner. |
| `eslint` | Linter. |

### Compatibility

- Node.js >= 18 (uses ES2022 features).
- TypeScript >= 5.0.
- No browser-specific APIs. Works in Node.js, Bun (Node.js compat), and Deno (Node.js compat).
- Compatible with any test framework (Jest, Vitest, Mocha, tap) -- the API returns plain objects and Promises.

---

## 19. File Structure

```
llm-regression/
├── package.json
├── tsconfig.json
├── SPEC.md
├── README.md
├── src/
│   ├── index.ts                     # Public API exports
│   ├── types.ts                     # All TypeScript type definitions
│   ├── compare.ts                   # compare() -- single-pair comparison
│   ├── compare-batch.ts             # compareBatch() -- batch comparison
│   ├── run-regression.ts            # runRegression() -- end-to-end pipeline
│   ├── create-regression.ts         # createRegression() factory
│   ├── classify.ts                  # Classification logic (regression/improvement/neutral)
│   ├── metrics/
│   │   ├── semantic.ts              # Semantic similarity (cosine on embeddings)
│   │   ├── jaccard.ts               # Jaccard word-level similarity
│   │   ├── rouge-l.ts              # ROUGE-L (longest common subsequence)
│   │   ├── bleu.ts                  # BLEU n-gram precision
│   │   ├── exact.ts                 # Exact string match
│   │   ├── contains.ts             # Key phrase containment
│   │   ├── structural.ts           # JSON structural comparison
│   │   └── custom.ts               # Custom metric wrapper
│   ├── baseline/
│   │   ├── save.ts                  # saveBaseline()
│   │   ├── load.ts                  # loadBaseline()
│   │   └── format.ts               # Baseline file serialization/deserialization
│   ├── format/
│   │   ├── terminal.ts              # Terminal colored output
│   │   ├── json.ts                  # JSON output
│   │   ├── markdown.ts              # Markdown output (PR comments)
│   │   ├── html.ts                  # HTML interactive report
│   │   └── colors.ts               # ANSI color utilities
│   ├── utils/
│   │   ├── tokenizer.ts            # Word tokenization
│   │   ├── stopwords.ts            # English stopword list
│   │   ├── cosine.ts               # Cosine similarity computation
│   │   ├── lcs.ts                   # Longest common subsequence (for ROUGE-L)
│   │   ├── ngrams.ts               # N-gram extraction (for BLEU)
│   │   ├── sentences.ts            # Sentence boundary detection (for contains)
│   │   ├── stats.ts                 # Statistical aggregation (mean, median, stddev)
│   │   └── deep-equal.ts           # Deep equality for structural comparison
│   └── cli.ts                       # CLI entry point
├── src/__tests__/
│   ├── metrics/
│   │   ├── semantic.test.ts
│   │   ├── jaccard.test.ts
│   │   ├── rouge-l.test.ts
│   │   ├── bleu.test.ts
│   │   ├── exact.test.ts
│   │   ├── contains.test.ts
│   │   ├── structural.test.ts
│   │   └── custom.test.ts
│   ├── compare.test.ts              # Single-pair comparison tests
│   ├── compare-batch.test.ts        # Batch comparison tests
│   ├── run-regression.test.ts       # End-to-end regression pipeline tests
│   ├── classify.test.ts             # Classification logic tests
│   ├── baseline.test.ts             # Baseline save/load tests
│   ├── format.test.ts               # Output formatting tests
│   └── cli.test.ts                  # CLI integration tests
└── dist/                            # Compiled output (not committed)
```

---

## 20. Implementation Roadmap

### Phase 1: Core Comparison Engine

Implement the foundational comparison pipeline that supports all lexical metrics and single-pair comparison.

1. Define all TypeScript types in `types.ts`.
2. Implement lexical metrics: `jaccard.ts`, `rouge-l.ts`, `bleu.ts`, `exact.ts`, `contains.ts`.
3. Implement utility modules: `tokenizer.ts`, `stopwords.ts`, `lcs.ts`, `ngrams.ts`, `sentences.ts`, `stats.ts`.
4. Implement `compare.ts` -- single-pair comparison with metric selection and classification.
5. Implement `classify.ts` -- classification logic (regression/improvement/neutral).
6. Write unit tests for all metrics and for `compare()`.
7. Wire up `index.ts` with initial exports: `compare`, types.

### Phase 2: Batch Comparison and Reporting

Add batch comparison, aggregate statistics, and multiple output formats.

1. Implement `compare-batch.ts` -- batch comparison with concurrency control.
2. Implement `stats.ts` -- statistical aggregation (mean, median, stddev).
3. Implement output formatters: `terminal.ts`, `json.ts`, `markdown.ts`.
4. Add aggregate threshold logic and overall pass/fail determination.
5. Write unit tests for batch comparison, statistics, and formatters.
6. Export `compareBatch` from `index.ts`.

### Phase 3: Semantic Metric and Custom Metric

Add the embedding-based semantic metric and the custom metric escape hatch.

1. Implement `semantic.ts` -- cosine similarity on user-provided embeddings.
2. Implement `cosine.ts` utility.
3. Implement `custom.ts` -- wrapper for user-provided scoring functions.
4. Write unit tests for semantic metric (with mock embedder) and custom metric.
5. Export updated types.

### Phase 4: End-to-End Regression Pipeline

Implement the `runRegression` function and the `createRegression` factory.

1. Implement `run-regression.ts` -- full pipeline: generate outputs, compare, report.
2. Implement `create-regression.ts` -- factory for pre-configured instances.
3. Implement `structural.ts` -- JSON structural comparison.
4. Write integration tests with mock LLM functions.
5. Export `runRegression` and `createRegression` from `index.ts`.

### Phase 5: Baseline Management

Add file-based baseline storage.

1. Implement `baseline/save.ts`, `baseline/load.ts`, `baseline/format.ts`.
2. Write tests for baseline save/load round-trip, error handling, metadata.
3. Export `saveBaseline` and `loadBaseline` from `index.ts`.

### Phase 6: CLI and HTML Output

Add the CLI and the HTML report format.

1. Implement `cli.ts` -- argument parsing, config file loading, exit codes.
2. Implement `html.ts` -- self-contained HTML report generator.
3. Add `bin` field to `package.json`.
4. Write CLI integration tests.
5. End-to-end testing of the full workflow.

---

## 21. Example Use Cases

### Prompt Iteration Regression Testing

A prompt engineer is iterating on a customer support chatbot prompt. They have 30 test conversations that represent common customer queries. After each prompt change, they run the regression test to verify the change did not break any existing behaviors.

```typescript
import { runRegression } from 'llm-regression';

const testInputs = [
  { id: 'refund', input: 'How do I get a refund?' },
  { id: 'hours', input: 'What are your business hours?' },
  { id: 'shipping', input: 'Where is my package?' },
  // ... 27 more
];

const report = await runRegression(
  testInputs,
  oldPrompt,
  newPrompt,
  callLlm,
  {
    metrics: ['semantic', 'contains'],
    thresholds: { semantic: 0.85, contains: 1.0 },
    embedFn: myEmbedFn,
    aggregateThreshold: 0.95,
  },
);

if (!report.summary.passed) {
  console.error(`Regressions in ${report.regressions.length} test cases:`);
  for (const r of report.regressions) {
    console.error(`  ${r.testId}: semantic=${r.scores.semantic?.toFixed(2)}`);
  }
}
```

### Model Migration Comparison

A team is migrating from GPT-3.5 to GPT-4o-mini. They run the same prompts against both models and compare outputs across their entire prompt library.

```typescript
import { compareBatch } from 'llm-regression';

// Generate outputs from both models
const gpt35Outputs = await generateAll(prompts, inputs, gpt35);
const gpt4oOutputs = await generateAll(prompts, inputs, gpt4oMini);

// Build test cases
const testCases = inputs.map((input, i) => ({
  id: `input-${i}`,
  input: input,
  baseline: gpt35Outputs[i],
  candidate: gpt4oOutputs[i],
}));

const report = await compareBatch(testCases, {
  metrics: ['semantic', 'jaccard', 'structural'],
  format: 'markdown',
});

// Post to a Slack channel or save as a report
console.log(report.formatted);
console.log(`\nModel migration impact: ${report.summary.regressions} regressions out of ${report.summary.total} test cases`);
```

### CI Regression Gate

A GitHub Actions workflow runs regression tests on every PR that modifies prompt templates.

```yaml
name: Prompt Regression Test
on:
  pull_request:
    paths: ['prompts/**']

jobs:
  regression:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: npm ci

      - name: Generate candidate outputs
        run: node scripts/generate-outputs.js > candidate.json
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}

      - name: Run regression test
        run: |
          npx llm-regression \
            --baseline baselines/current.json \
            --candidate candidate.json \
            --metric jaccard \
            --threshold 0.60 \
            --aggregate-threshold 0.95 \
            --format markdown > report.md

      - name: Post regression report
        if: always()
        uses: marocchino/sticky-pull-request-comment@v2
        with:
          path: report.md
```

### A/B Prompt Evaluation

A team is deciding between two candidate prompts for a classification task. They run both against a labeled test set and compare quality against the ground truth.

```typescript
import { compareBatch } from 'llm-regression';

const testCases = testSet.map(t => ({
  id: t.id,
  input: t.input,
  baseline: promptAOutputs[t.id],
  candidate: promptBOutputs[t.id],
  thresholds: { semantic: 0.80 },
}));

const report = await compareBatch(testCases, {
  metrics: ['semantic', 'jaccard'],
  format: 'terminal',
});

// Prompt A is baseline. If candidate (Prompt B) scores well,
// it means B produces outputs similar to A.
// If we also compare both against ground truth:
const qualityA = await compareBatch(
  testSet.map(t => ({ id: t.id, baseline: t.groundTruth, candidate: promptAOutputs[t.id] })),
  { metric: 'semantic', embedFn: myEmbedFn },
);
const qualityB = await compareBatch(
  testSet.map(t => ({ id: t.id, baseline: t.groundTruth, candidate: promptBOutputs[t.id] })),
  { metric: 'semantic', embedFn: myEmbedFn },
);

console.log(`Prompt A quality: ${qualityA.aggregateScores.semantic.mean.toFixed(3)}`);
console.log(`Prompt B quality: ${qualityB.aggregateScores.semantic.mean.toFixed(3)}`);
console.log(`Winner: ${qualityA.aggregateScores.semantic.mean > qualityB.aggregateScores.semantic.mean ? 'A' : 'B'}`);
```
