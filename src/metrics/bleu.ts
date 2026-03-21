export interface BleuOptions {
  maxN?: number;
  weights?: number[];
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\b\w+\b/g) ?? [];
}

function getNgrams(tokens: string[], n: number): Map<string, number> {
  const ngrams = new Map<string, number>();
  for (let i = 0; i <= tokens.length - n; i++) {
    const gram = tokens.slice(i, i + n).join(' ');
    ngrams.set(gram, (ngrams.get(gram) ?? 0) + 1);
  }
  return ngrams;
}

function modifiedPrecision(reference: string[], candidate: string[], n: number): number {
  if (candidate.length < n) return 0;

  const refNgrams = getNgrams(reference, n);
  const hypNgrams = getNgrams(candidate, n);

  let clippedCount = 0;
  let totalCount = 0;

  for (const [gram, count] of hypNgrams) {
    totalCount += count;
    const refCount = refNgrams.get(gram) ?? 0;
    clippedCount += Math.min(count, refCount);
  }

  if (totalCount === 0) return 0;
  return clippedCount / totalCount;
}

export function bleuScore(
  baseline: string,
  candidate: string,
  options: BleuOptions = {},
): number {
  const maxN = options.maxN ?? 4;

  const refTokens = tokenize(baseline);
  const hypTokens = tokenize(candidate);

  if (hypTokens.length === 0) return 0;

  const weights =
    options.weights ??
    Array<number>(maxN).fill(1 / maxN);

  // Brevity penalty
  const bp =
    hypTokens.length >= refTokens.length
      ? 1
      : Math.exp(1 - refTokens.length / hypTokens.length);

  // Geometric mean of modified precisions (log-space)
  let logSum = 0;
  for (let n = 1; n <= maxN; n++) {
    const p = modifiedPrecision(refTokens, hypTokens, n);
    if (p === 0) return 0; // If any n-gram precision is 0, score is 0
    logSum += weights[n - 1] * Math.log(p);
  }

  return bp * Math.exp(logSum);
}
