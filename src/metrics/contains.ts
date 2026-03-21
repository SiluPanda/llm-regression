export interface ContainsOptions {
  phrases?: string[];
  caseSensitive?: boolean;
}

export function containsScore(
  baseline: string,
  candidate: string,
  options: ContainsOptions = {},
): number {
  const { phrases, caseSensitive = false } = options;

  if (phrases && phrases.length > 0) {
    const text = caseSensitive ? candidate : candidate.toLowerCase();
    let found = 0;
    for (const phrase of phrases) {
      const target = caseSensitive ? phrase : phrase.toLowerCase();
      if (text.includes(target)) found++;
    }
    return found / phrases.length;
  }

  // No phrases provided: check if baseline is contained in candidate
  const a = caseSensitive ? baseline : baseline.toLowerCase();
  const b = caseSensitive ? candidate : candidate.toLowerCase();
  return b.includes(a) ? 1.0 : 0.0;
}
