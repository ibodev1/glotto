import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import { encodeBase64 } from '@std/encoding';
import type { JsonObject, Translatable } from '../types.ts';
import { generatePrompts, isValidJson } from '../utilites.ts';
import { logger } from '../logger.ts';
import { mergeInputs, writeTemp } from '../file.ts';

/**
 * Gemini AI Module
 */
class Gemini implements Translatable {
  fileContents: Uint8Array[];
  from: string;
  to: string;
  genAI: GoogleGenerativeAI;

  constructor(key: string, fileContents: Uint8Array[], from: string, to: string) {
    this.fileContents = fileContents;
    this.from = from;
    this.to = to;
    this.genAI = new GoogleGenerativeAI(key);
  }

  async translate() {
    const { systemPrompt, userPrompt } = generatePrompts(this.from, this.to);

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
      generationConfig: {
        candidateCount: 1,
        responseMimeType: 'application/json',
        responseLogprobs: false,
        temperature: 0.3,
        topP: 0.7,
        topK: 20,
        presencePenalty: 0.2,
        frequencyPenalty: 0.2,
        maxOutputTokens: Number.POSITIVE_INFINITY,
      },
    });

    const results: string[] = [];
    let index = 0;

    for (const file of this.fileContents) {
      const fileBase64 = encodeBase64(file);

      const part: Part = {
        inlineData: {
          data: fileBase64,
          mimeType: 'text/plain',
        },
      };

      const { response } = await model.generateContent([systemPrompt, userPrompt, part]);
      const text = response.text();

      const tempJsonFileName = `${this.to}_${index + 1}.json`;
      await writeTemp(tempJsonFileName, text);

      if (!isValidJson(text)) {
        logger.error('Json is not valid!', tempJsonFileName);
        continue;
      }

      results.push(text);

      index++;
    }

    const jsonInputs = results.map<JsonObject>((r) => JSON.parse(r));

    const mergedContent = mergeInputs(jsonInputs);

    return JSON.stringify(mergedContent, null, 2);
  }
}

export default Gemini;
