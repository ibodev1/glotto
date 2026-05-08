import OpenAI from '@openai/openai';
import type { TextTranslator, TranslateOptions, TranslateResult, TranslateUsage } from '../types.ts';
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

  async translate(prompt: string): Promise<TranslateResult> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });
    const text = completion.choices[0]?.message?.content ?? '';
    let usage: TranslateUsage | undefined;
    if (completion.usage) {
      usage = {
        inputTokens: completion.usage.prompt_tokens ?? 0,
        outputTokens: completion.usage.completion_tokens ?? 0,
      };
    }
    return { text, usage };
  }
}

export default OpenAIModel;
