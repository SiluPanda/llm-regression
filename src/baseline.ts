import fs from 'fs/promises';
import type { BaselineEntry, BaselineFile, SaveBaselineOptions } from './types';

export async function saveBaseline(
  entries: BaselineEntry[],
  filePath: string,
  options: SaveBaselineOptions = {},
): Promise<void> {
  const file: BaselineFile = {
    __meta: {
      version: 1,
      createdAt: new Date().toISOString(),
      ...(options.promptVersion !== undefined && { promptVersion: options.promptVersion }),
      ...(options.model !== undefined && { model: options.model }),
    },
    entries,
  };

  await fs.writeFile(filePath, JSON.stringify(file, null, 2), 'utf-8');
}

export async function loadBaseline(filePath: string): Promise<BaselineFile> {
  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed: unknown = JSON.parse(raw);

  // Basic shape validation
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('__meta' in parsed) ||
    !('entries' in parsed)
  ) {
    throw new Error(`Invalid baseline file at ${filePath}: missing __meta or entries`);
  }

  return parsed as BaselineFile;
}
