import { GoogleGenAI } from '@google/genai';
import type { TextTranslator, TranslateOptions } from '../types.ts';
import { DEFAULT_MODELS } from '../contants.ts';

class Gemini implements TextTranslator {
  private genAI: GoogleGenAI;
  private model: string;

  constructor(
    key: string,
    modelName?: string,
    options: TranslateOptions = { noLimit: false, noTimeout: false },
  ) {
    this.model = modelName ?? DEFAULT_MODELS.gemini;
    this.genAI = new GoogleGenAI({
      apiKey: key,
      httpOptions: options.noTimeout ? { timeout: 2_147_483_647 } : undefined,
    });
  }

  async translate(prompt: string): Promise<string> {
    const { text } = await this.genAI.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        candidateCount: 1,
        temperature: 0.2,
      },
    });
    return text ?? '';
  }
}

export default Gemini;
