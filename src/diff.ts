function tokenize(text: string): string[] {
  // Split on word boundaries while preserving punctuation as separate tokens
  return text.match(/\S+/g) ?? [];
}

export function computeDiff(baseline: string, candidate: string): string {
  const baselineTokens = tokenize(baseline);
  const candidateTokens = tokenize(candidate);

  if (baselineTokens.length === 0 && candidateTokens.length === 0) return '';

  const baseSet = new Set(baselineTokens);
  const candSet = new Set(candidateTokens);

  const parts: string[] = [];

  // Show removed tokens (in baseline but not candidate)
  for (const token of baselineTokens) {
    if (!candSet.has(token)) {
      parts.push(`[-${token}-]`);
    }
  }

  // Show added tokens (in candidate but not baseline)
  for (const token of candidateTokens) {
    if (!baseSet.has(token)) {
      parts.push(`[+${token}+]`);
    }
  }

  if (parts.length === 0) {
    return '(no diff)';
  }

  return parts.join(' ');
}
