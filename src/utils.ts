import type { Path } from "./types.ts";

export function splitList(value: string | readonly string[]): string[] {
  const items = typeof value === "string" ? value.split(",") : value;
  return items.map((item) => item.trim()).filter((item) => item.length > 0);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatPath(path: Path): string {
  let formatted = "";
  for (const segment of path) {
    if (typeof segment === "number") {
      formatted += `[${segment}]`;
    } else {
      formatted += formatted === "" ? segment : `.${segment}`;
    }
  }
  return formatted === "" ? "(root)" : formatted;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function sumBy<T>(
  items: readonly T[],
  pick: (item: T) => number,
): number {
  let total = 0;
  for (const item of items) {
    total += pick(item);
  }
  return total;
}
