const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'and', 'but', 'or', 'not',
]);

export interface JaccardOptions {
  caseSensitive?: boolean;
  removeStopwords?: boolean;
}

function tokenize(text: string, caseSensitive: boolean, removeStopwords: boolean): Set<string> {
  const normalized = caseSensitive ? text : text.toLowerCase();
  const words = normalized.match(/\b\w+\b/g) ?? [];
  const filtered = removeStopwords ? words.filter((w) => !STOPWORDS.has(w)) : words;
  return new Set(filtered);
}

export function jaccardSimilarity(
  baseline: string,
  candidate: string,
  options: JaccardOptions = {},
): number {
  const { caseSensitive = false, removeStopwords = false } = options;

  const setA = tokenize(baseline, caseSensitive, removeStopwords);
  const setB = tokenize(candidate, caseSensitive, removeStopwords);

  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return intersection / union;
}
