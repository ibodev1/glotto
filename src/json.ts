import type { JsonContainer, JsonValue, Path, PathSegment } from "./types.ts";

export function isContainer(
  value: JsonValue | undefined,
): value is JsonContainer {
  return typeof value === "object" && value !== null;
}

export function containerFor(segment: PathSegment): JsonContainer {
  if (typeof segment === "number") {
    return [];
  }
  return {};
}

export function fitsSegment(
  container: JsonContainer,
  segment: PathSegment,
): boolean {
  return Array.isArray(container) === (typeof segment === "number");
}

function getChild(
  container: JsonContainer,
  segment: PathSegment,
): JsonValue | undefined {
  if (Array.isArray(container)) {
    return typeof segment === "number" ? container[segment] : undefined;
  }
  if (typeof segment !== "string" || !Object.hasOwn(container, segment)) {
    return undefined;
  }
  return container[segment];
}

function setChild(
  container: JsonContainer,
  segment: PathSegment,
  value: JsonValue,
): void {
  if (Array.isArray(container)) {
    if (typeof segment === "number") {
      container[segment] = value;
    }
    return;
  }
  if (typeof segment === "string") {
    Object.defineProperty(container, segment, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
}

export function getPath(root: JsonValue, path: Path): JsonValue | undefined {
  let node: JsonValue | undefined = root;
  for (const segment of path) {
    if (!isContainer(node)) {
      return undefined;
    }
    node = getChild(node, segment);
  }
  return node;
}

export function setPath(
  root: JsonContainer,
  path: Path,
  value: JsonValue,
): void {
  const last = path.at(-1);
  if (last === undefined) {
    return;
  }
  let node = root;
  for (let index = 0; index < path.length - 1; index++) {
    const segment = path[index];
    const next = path[index + 1];
    if (segment === undefined || next === undefined) {
      return;
    }
    const child = getChild(node, segment);
    if (isContainer(child) && fitsSegment(child, next)) {
      node = child;
      continue;
    }
    const created = containerFor(next);
    setChild(node, segment, created);
    node = created;
  }
  setChild(node, last, value);
}
