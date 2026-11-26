import {
  containerFor,
  fitsSegment,
  getPath,
  isContainer,
  setPath,
} from "./json.ts";
import { isTranslatable, leafValue } from "./translator.ts";
import type { JsonValue, Leaf, TranslatableLeaf } from "./types.ts";

function isFilled(value: JsonValue | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function findMissingLeaves(
  leaves: readonly Leaf[],
  target: JsonValue,
): TranslatableLeaf[] {
  return leaves
    .filter(isTranslatable)
    .filter((leaf) => !isFilled(getPath(target, leaf.path)));
}

export function mergeTranslations(
  target: JsonValue,
  leaves: readonly Leaf[],
  translations: ReadonlyMap<number, string>,
): JsonValue {
  const first = leaves[0];
  const firstSegment = first?.path[0];
  if (first === undefined || firstSegment === undefined) {
    return first === undefined
      ? target
      : (translations.get(first.id) ?? target);
  }
  const root =
    isContainer(target) && fitsSegment(target, firstSegment)
      ? structuredClone(target)
      : containerFor(firstSegment);
  for (const leaf of leaves) {
    const translation = translations.get(leaf.id);
    if (translation !== undefined) {
      setPath(root, leaf.path, translation);
      continue;
    }
    if (getPath(root, leaf.path) !== undefined) {
      continue;
    }
    const fallback = leafValue(leaf, translations);
    if (fallback !== undefined) {
      setPath(root, leaf.path, fallback);
    }
  }
  return root;
}
