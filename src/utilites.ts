import type { Module, TranslateArgs, ValidatedTranslateArgs } from './types.ts';
import type { Args } from '@std/cli';

/**
 * Validates and processes command-line arguments
 * @param args - Raw arguments from CLI
 * @returns Processed and type-safe arguments
 * @throws Error if any required parameter is missing
 */
export const validateArgs = (args: Args<TranslateArgs>): ValidatedTranslateArgs => {
  if (!args.key) {
    throw new Error('AI Key is required');
  }

  if (!args.module) {
    throw new Error('Module parameter is required');
  }

  if (!args.input) {
    throw new Error('Input parameter is required');
  }

  if (!args.output) {
    throw new Error('Output parameter is required');
  }

  if (!args.from) {
    throw new Error('Source language (from) parameter is required');
  }

  if (!args.to) {
    throw new Error('Target language (to) parameter is required');
  }

  return {
    key: args.key,
    module: args.module as Module,
    input: args.input,
    output: args.output,
    from: args.from,
    to: args.to,
    maxkeys: Number(args.maxkeys),
  };
};

/**
 * Generates system and user prompts for AI translation
 * Creates detailed instructions for translating i18next JSON files
 * @param from - Source language for translation
 * @param to - Target language for translation
 * @returns Object containing system and user prompts
 */
export const generatePrompts = (from: string, to: string) => {
  const systemPrompt =
    `You are a specialized i18next JSON translation expert. Your role is to translate content from ${from} to ${to} with these strict requirements:
  
  1. COMPLETE TRANSLATION:
     - Translate ALL text values comprehensively
     - Double-check to ensure no text is left untranslated
     - Pay special attention to arrays and nested objects to ensure everything is translated
     - If unsure about any translation, provide the most accurate and natural translation possible
  
  2. TRANSLATION QUALITY:
     - Use natural, context-appropriate language
     - Maintain consistent terminology throughout the translation
     - Use formal language unless the source is clearly casual
     - Preserve the exact meaning and tone of the original text
     - For UI elements, use standard localized terms common in ${to} applications
  
  3. STRUCTURAL PRESERVATION:
     - Keep all JSON structure and keys exactly as they are
     - Maintain all variables and interpolation patterns ({{name}}, __VARIABLE__, $t(), etc.)
     - Preserve all HTML tags and markdown formatting
     - Keep all whitespace, nesting, and formatting intact
  
  4. VALIDATION:
     - Return only valid JSON
     - Verify that all text is translated
     - Ensure no source language text remains
     - Confirm all arrays and nested objects are fully translated`;

  const userPrompt = `Please translate this i18next JSON file with these specific requirements:
  
  1. THOROUGH TRANSLATION:
     - Translate every single text value from ${from} to ${to}
     - Pay special attention to arrays and nested objects
     - Verify no text is left in ${from}
     - Double-check all translations for completeness
  
  2. PRESERVE STRUCTURE:
     - Keep all keys unchanged (e.g. "button.submit")
     - Maintain all variables: {{name}}, __VAR__, $t()
     - Preserve HTML tags and markdown
     - Keep all special characters
     - Maintain exact JSON structure
  
  3. QUALITY REQUIREMENTS:
     - Use natural ${to} language
     - Maintain consistent terminology
     - Use formal language unless source is casual
     - Ensure translations match the context
     - Use standard ${to} UI terminology for interface elements
  
  4. OUTPUT:
     - Return only the translated JSON
     - No explanations or comments
     - No additional text
     - No formatting changes
     - Must be valid JSON`;

  return { systemPrompt, userPrompt };
};

/**
 * Validates whether a string represents valid JSON
 * @param value - String to validate as JSON
 * @returns Boolean indicating if the string is valid JSON
 */
export const isValidJson = (value: string): boolean => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};
