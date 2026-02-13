export type Module = 'gemini' | 'openai' | 'anthropic';

export type TranslateArgs = {
  key?: string;
  module?: string;
  input?: string;
  output?: string;
  from?: string;
  to?: string;
  url?: string;
};

export type ValidatedTranslateArgs = {
  key: string;
  module: Module;
  input: string;
  output: string;
  from: string;
  to: string;
  url?: string;
};

export interface Translatable {
  chunks: ChunkInfo[];
  from: string;
  to: string;
  translate(): Promise<string>;
}

export type JsonObject = Record<string, any>;

export type Chunk = Uint8Array;

export type ChunkInfo = {
  data: Uint8Array;

  keyCount: number;

  byteSize: number;

  index: number;
};
