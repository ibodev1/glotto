import { GoogleGenAI } from '@google/genai';
import type { TextTranslator, TranslateOptions, TranslateResult, TranslateUsage } from '../types.ts';
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

  async translate(prompt: string): Promise<TranslateResult> {
    const response = await this.genAI.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        candidateCount: 1,
        temperature: 0.2,
      },
    });
    const text = response.text ?? '';
    let usage: TranslateUsage | undefined;
    if (response.usageMetadata) {
      usage = {
        inputTokens: response.usageMetadata.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata.candidatesTokenCount ?? 0,
      };
    }
    return { text, usage };
  }
}

export default Gemini;
