export type JsonPrimitive = string | number | boolean | null;

export interface JsonObject {
  [key: string]: JsonValue;
}

export type JsonArray = JsonValue[];

export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type JsonContainer = JsonObject | JsonArray;

export type PathSegment = string | number;

export type Path = readonly PathSegment[];

export type Leaf = {
  readonly id: number;
  readonly path: Path;
  readonly value: JsonValue;
  readonly translatable: boolean;
};

export type TranslatableLeaf = Leaf & {
  readonly value: string;
  readonly translatable: true;
};

export type Batch = {
  readonly index: number;
  readonly leaves: readonly TranslatableLeaf[];
  readonly byteSize: number;
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type TranslateResult = {
  readonly text: string;
  readonly usage?: TokenUsage;
};

export interface TextTranslator {
  translate(prompt: string): Promise<TranslateResult>;
}
