import type { JsonValue } from "./types.ts";
import { errorMessage } from "./utils.ts";

const BYTE_ORDER_MARK = /^\uFEFF/;

export function parseJson(text: string, source: string): JsonValue {
  try {
    const value: JsonValue = JSON.parse(text.replace(BYTE_ORDER_MARK, ""));
    return value;
  } catch (error) {
    throw new Error(`Invalid JSON in ${source}: ${errorMessage(error)}`);
  }
}

export async function readJsonFile(path: string): Promise<JsonValue | null> {
  const file = Bun.file(path);
  const exists = await file.exists();
  if (!exists) {
    return null;
  }
  const text = await file.text();
  if (text.trim() === "") {
    return null;
  }
  return parseJson(text, path);
}

export async function writeJsonFile(
  path: string,
  value: JsonValue,
): Promise<void> {
  await Bun.write(path, `${JSON.stringify(value, null, 2)}\n`);
}
