import Anthropic from '@anthropic-ai/sdk';
import type { TextTranslator, TranslateOptions, TranslateResult, TranslateUsage } from '../types.ts';
import { DEFAULT_MODELS } from '../contants.ts';

class AnthropicModel implements TextTranslator {
  private client: Anthropic;
  private model: string;

  constructor(
    key: string,
    baseUrl?: string,
    modelName?: string,
    options: TranslateOptions = { noLimit: false, noTimeout: false },
  ) {
    this.model = modelName ?? DEFAULT_MODELS.anthropic;
    this.client = new Anthropic({
      apiKey: key,
      baseURL: baseUrl,
      timeout: options.noTimeout ? 0 : undefined,
    });
  }

  async translate(prompt: string): Promise<TranslateResult> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 8192,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content
      .filter((part): part is Anthropic.TextBlock => part.type === 'text')
      .map((part) => part.text)
      .join('');
    let usage: TranslateUsage | undefined;
    if (message.usage) {
      usage = {
        inputTokens: message.usage.input_tokens ?? 0,
        outputTokens: message.usage.output_tokens ?? 0,
      };
    }
    return { text, usage };
  }
}

export default AnthropicModel;
