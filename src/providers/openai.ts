import OpenAI from '@openai/openai';
import type { TextTranslator, TranslateOptions } from '../types.ts';
import { DEFAULT_MODELS } from '../contants.ts';

class OpenAIModel implements TextTranslator {
  private client: OpenAI;
  private model: string;

  constructor(
    key: string,
    baseUrl?: string,
    modelName?: string,
    options: TranslateOptions = { noLimit: false, noTimeout: false },
  ) {
    this.model = modelName ?? DEFAULT_MODELS.openai;
    this.client = new OpenAI({
      apiKey: key,
      baseURL: baseUrl,
      timeout: options.noTimeout ? 2_147_483_647 : undefined,
    });
  }

  async translate(prompt: string): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });
    return completion.choices[0]?.message?.content ?? '';
  }
}

export default OpenAIModel;
