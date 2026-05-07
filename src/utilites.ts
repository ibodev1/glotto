import type { Provider, TranslateArgs, ValidatedTranslateArgs } from './types.ts';
import type { Args } from '@std/cli';

export const validateArgs = (args: Args<TranslateArgs>): ValidatedTranslateArgs => {
  if (!args.key) {
    throw new Error('AI Key is required');
  }

  if (!args.provider) {
    throw new Error('Provider parameter is required');
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
    provider: args.provider as Provider,
    model: args.model,
    input: args.input,
    output: args.output,
    from: args.from,
    to: args.to,
    url: args.url,
  };
};

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

export const stripJsonMarkdown = (text: string): string => {
  const trimmed = text.trim();

  // Extract from code fence if present (handles surrounding text too)
  const fenceMatch = trimmed.match(/```(?:\w+)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    const candidate = fenceMatch[1].trim();
    if (candidate.startsWith('{') || candidate.startsWith('[')) {
      return candidate;
    }
  }

  // Find outermost JSON structure by tracking bracket depth,
  // correctly ignoring brackets inside strings and escape sequences
  const firstBrace = trimmed.indexOf('{');
  const firstBracket = trimmed.indexOf('[');

  if (firstBrace === -1 && firstBracket === -1) return trimmed;

  let startIndex: number;
  let openChar: string;
  let closeChar: string;

  if (firstBrace === -1 || (firstBracket !== -1 && firstBracket < firstBrace)) {
    startIndex = firstBracket;
    openChar = '[';
    closeChar = ']';
  } else {
    startIndex = firstBrace;
    openChar = '{';
    closeChar = '}';
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === openChar) depth++;
    else if (char === closeChar && --depth === 0) return trimmed.slice(startIndex, i + 1);
  }

  return trimmed;
};

export const isValidJson = (value: string): boolean => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
