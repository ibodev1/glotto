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
  maxkeys?: string | number;
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
  maxkeys: number;
};

/**
 * Interface defining required methods and properties for translation modules
 * Implementations handle the actual translation logic using an AI service
 */
export interface Translatable {
  fileContents: Uint8Array[];
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
