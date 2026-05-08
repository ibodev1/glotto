import Anthropic from '@anthropic-ai/sdk';
import type { TextTranslator, TranslateOptions } from '../types.ts';
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

  async translate(prompt: string): Promise<string> {
    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: 8192,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    });
    return message.content
      .filter((part): part is Anthropic.TextBlock => part.type === 'text')
      .map((part) => part.text)
      .join('');
  }
}

export default AnthropicModel;
