export interface ExactMatchOptions {
  trim?: boolean;
  normalizeWhitespace?: boolean;
  caseSensitive?: boolean;
}

export function exactMatch(
  baseline: string,
  candidate: string,
  options: ExactMatchOptions = {},
): number {
  const { trim = true, normalizeWhitespace = true, caseSensitive = false } = options;

  let a = baseline;
  let b = candidate;

  if (trim) {
    a = a.trim();
    b = b.trim();
  }

  if (normalizeWhitespace) {
    a = a.replace(/\s+/g, ' ');
    b = b.replace(/\s+/g, ' ');
  }

  if (!caseSensitive) {
    a = a.toLowerCase();
    b = b.toLowerCase();
  }

  return a === b ? 1.0 : 0.0;
}
