import type { JsonValue, Leaf, Path } from './types.ts';
import { setPath } from './translator.ts';

function getPath(root: JsonValue, path: Path): JsonValue | undefined {
  let node: JsonValue = root;
  for (const key of path) {
    if (node === null || typeof node !== 'object') {
      return undefined;
    }
    const container = node as Record<string | number, JsonValue>;
    if (!(key in container)) {
      return undefined;
    }
    node = container[key];
  }
  return node;
}

function isPresentTranslation(value: JsonValue | undefined): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return value.trim().length > 0;
}

export function findMissingLeaves(sourceLeaves: Leaf[], existingTarget: JsonValue): Leaf[] {
  const missing: Leaf[] = [];
  for (const leaf of sourceLeaves) {
    if (!leaf.translatable) {
      continue;
    }
    const existingValue = getPath(existingTarget, leaf.path);
    if (!isPresentTranslation(existingValue)) {
      missing.push(leaf);
    }
  }
  return missing;
}

function deepClone(value: JsonValue): JsonValue {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

export function mergeTranslations(
  existingTarget: JsonValue,
  sourceLeaves: Leaf[],
  translations: Map<number, string>,
): JsonValue {
  const clone = deepClone(existingTarget);
  for (const leaf of sourceLeaves) {
    if (!translations.has(leaf.id)) {
      continue;
    }
    if (leaf.path.length === 0) {
      return translations.get(leaf.id) as JsonValue;
    }
    setPath(clone, leaf.path, translations.get(leaf.id) as JsonValue);
  }
  return clone;
}
