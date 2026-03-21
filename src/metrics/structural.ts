export interface StructuralOptions {
  allowExtraKeys?: boolean;
  allowMissingKeys?: boolean;
  checkArrayLength?: boolean;
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function getType(value: JsonValue): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function compareStructure(
  baseline: JsonValue,
  candidate: JsonValue,
  options: StructuralOptions,
): { matching: number; total: number } {
  const { allowExtraKeys = false, allowMissingKeys = false, checkArrayLength = false } = options;

  const baseType = getType(baseline);
  const candType = getType(candidate);

  // Type mismatch at this level
  if (baseType !== candType) {
    return { matching: 0, total: 1 };
  }

  // Primitives and null: type matched
  if (baseType !== 'object' && baseType !== 'array') {
    return { matching: 1, total: 1 };
  }

  // Arrays
  if (baseType === 'array') {
    const baseArr = baseline as JsonValue[];
    const candArr = candidate as JsonValue[];

    if (checkArrayLength) {
      if (baseArr.length !== candArr.length) {
        return { matching: 0, total: 1 };
      }
    }

    // Compare element types up to the shorter length
    const len = Math.min(baseArr.length, candArr.length);
    if (len === 0) return { matching: 1, total: 1 };

    let matching = 0;
    let total = 0;
    for (let i = 0; i < len; i++) {
      const sub = compareStructure(baseArr[i], candArr[i], options);
      matching += sub.matching;
      total += sub.total;
    }
    return { matching, total };
  }

  // Objects
  const baseObj = baseline as Record<string, JsonValue>;
  const candObj = candidate as Record<string, JsonValue>;
  const baseKeys = Object.keys(baseObj);
  const candKeys = new Set(Object.keys(candObj));

  let matching = 0;
  let total = 0;

  for (const key of baseKeys) {
    if (!candKeys.has(key)) {
      // Missing key in candidate
      if (!allowMissingKeys) {
        total += 1; // counts as a mismatch
      }
    } else {
      const sub = compareStructure(baseObj[key], candObj[key], options);
      matching += sub.matching;
      total += sub.total;
    }
  }

  // Extra keys in candidate
  if (!allowExtraKeys) {
    for (const key of candKeys) {
      if (!baseKeys.includes(key)) {
        total += 1; // extra key penalizes
      }
    }
  }

  return { matching, total };
}

export function structuralSimilarity(
  baseline: string,
  candidate: string,
  options: StructuralOptions = {},
): number {
  let baselineObj: JsonValue;
  let candidateObj: JsonValue;

  try {
    baselineObj = JSON.parse(baseline) as JsonValue;
  } catch {
    return 0.0;
  }

  try {
    candidateObj = JSON.parse(candidate) as JsonValue;
  } catch {
    return 0.0;
  }

  const { matching, total } = compareStructure(baselineObj, candidateObj, options);

  if (total === 0) return 1.0;
  return matching / total;
}
