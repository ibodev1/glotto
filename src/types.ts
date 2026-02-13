/**
 * Available AI translation modules
 */
export type Module = 'gemini';

/**
 * Command-line arguments before validation and processing
 * Contains optional parameters as received from CLI input
 */
export type TranslateArgs = {
  key?: string;
  module?: string;
  input?: string;
  output?: string;
  from?: string;
  to?: string;
};

/**
 * Command-line arguments after validation and processing
 * All properties are required and properly typed
 */
export type ValidatedTranslateArgs = {
  key: string;
  module: Module;
  input: string;
  output: string;
  from: string;
  to: string;
};

/**
 * Interface defining required methods and properties for translation modules
 * Implementations handle the actual translation logic using an AI service
 */
export interface Translatable {
  chunks: ChunkInfo[];
  from: string;
  to: string;
  translate(): Promise<string>;
}

/**
 * Generic type representing any valid JSON object structure
 */
// deno-lint-ignore no-explicit-any
export type JsonObject = Record<string, any>;

/**
 * Binary representation of a JSON data chunk
 * Used when processing large JSON files in batches
 */
export type Chunk = Uint8Array;

/**
 * Metadata and data for a single chunk of a split JSON object.
 * Contains the encoded binary data plus useful metadata for logging and debugging.
 */
export type ChunkInfo = {
  /** Encoded binary data of the serialized JSON chunk */
  data: Uint8Array;
  /** Number of top-level keys in this chunk */
  keyCount: number;
  /** Byte size of the serialized JSON string */
  byteSize: number;
  /** Zero-based index of this chunk in the split sequence */
  index: number;
};
