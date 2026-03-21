function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\b\w+\b/g) ?? [];
}

function lcsLength(a: string[], b: string[]): number {
  const m = a.length;
  const n = b.length;

  // Use two-row DP to save memory
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }

  return prev[n];
}

export function rougeL(baseline: string, candidate: string): number {
  const refTokens = tokenize(baseline);
  const hypTokens = tokenize(candidate);

  if (refTokens.length === 0 && hypTokens.length === 0) return 1.0;
  if (refTokens.length === 0 || hypTokens.length === 0) return 0.0;

  const lcs = lcsLength(refTokens, hypTokens);

  if (lcs === 0) return 0.0;

  const precision = lcs / hypTokens.length;
  const recall = lcs / refTokens.length;

  return (2 * precision * recall) / (precision + recall);
}
