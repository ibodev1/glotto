export type Provider = 'gemini' | 'openai' | 'anthropic';

export type TranslateOptions = {
  noLimit: boolean;
  noTimeout: boolean;
};

export type TranslateArgs = {
  key?: string;
  provider?: string;
  model?: string;
  input?: string;
  output?: string;
  from?: string;
  to?: string;
  url?: string;
  config?: string;
  stats?: boolean;
  incremental?: boolean;
  'no-limit'?: boolean;
  'no-timeout'?: boolean;
  'max-batch-size'?: string;
};

export type ValidatedTranslateArgs = {
  key: string;
  provider: Provider;
  model?: string;
  input: string;
  output: string[];
  from: string;
  to: string[];
  url?: string;
  noLimit: boolean;
  noTimeout: boolean;
  maxBatchBytes: number;
  stats: boolean;
  incremental: boolean;
};

export type GlottoConfig = {
  key?: string;
  provider?: Provider;
  model?: string;
  input?: string;
  output?: string | string[];
  from?: string;
  to?: string | string[];
  url?: string;
  noLimit?: boolean;
  noTimeout?: boolean;
  maxBatchSize?: number;
  stats?: boolean;
  incremental?: boolean;
};

export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

export type PathSegment = string | number;
export type Path = PathSegment[];

export type Leaf = {
  id: number;
  path: Path;
  value: JsonValue;
  translatable: boolean;
};

export type Batch = {
  index: number;
  leaves: Leaf[];
  byteSize: number;
};

export type TranslateUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type TranslateResult = {
  text: string;
  usage?: TranslateUsage;
};

export interface TextTranslator {
  translate(prompt: string): Promise<TranslateResult>;
}
