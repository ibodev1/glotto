import { GoogleGenAI, type Part } from '@google/genai';
import { encodeBase64 } from '@std/encoding';
import type { ChunkInfo, JsonObject, Translatable } from '../types.ts';
import { delay, formatBytes, generatePrompts, isValidJson, stripJsonMarkdown } from '../utilites.ts';
import { logger } from '../logger.ts';
import { mergeInputs, writeTemp } from '../file.ts';
import { BASE_RETRY_DELAY_MS, DEFAULT_MODELS, INTER_CHUNK_DELAY_MS, MAX_RETRIES } from '../contants.ts';

class Gemini implements Translatable {
  chunks: ChunkInfo[];
  from: string;
  to: string;
  genAI: GoogleGenAI;
  model: string;

  constructor(key: string, chunks: ChunkInfo[], from: string, to: string, modelName?: string) {
    this.chunks = chunks;
    this.from = from;
    this.to = to;
    this.model = modelName ?? DEFAULT_MODELS.gemini;
    this.genAI = new GoogleGenAI({
      apiKey: key,
    });
  }

  private async translateChunk(chunk: ChunkInfo, systemPrompt: string, userPrompt: string): Promise<string | null> {
    const chunkLabel = `[Chunk ${chunk.index + 1}/${this.chunks.length}]`;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const backoffMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          logger.warn(`${chunkLabel} Retry ${attempt}/${MAX_RETRIES} after ${backoffMs}ms backoff...`);
          await delay(backoffMs);
        }

        const fileBase64 = encodeBase64(chunk.data);

        const part: Part = {
          inlineData: {
            data: fileBase64,
            mimeType: 'text/plain',
          },
        };

        const { text } = await this.genAI.models.generateContent({
          model: this.model,
          contents: [systemPrompt, userPrompt, part],
          config: {
            systemInstruction: systemPrompt,
            candidateCount: 1,
            responseMimeType: 'application/json',
            responseLogprobs: false,
            temperature: 0.3,
            topP: 0.7,
            topK: 20,
            maxOutputTokens: Number.POSITIVE_INFINITY,
          },
        });

        if (!text) {
          logger.error(`${chunkLabel} Empty response from Gemini AI`);
          continue;
        }

        const cleanedText = stripJsonMarkdown(text);

        const tempJsonFileName = `chunk_${chunk.index + 1}.json`;
        await writeTemp(this.to, tempJsonFileName, cleanedText);

        if (!isValidJson(cleanedText)) {
          if (attempt === MAX_RETRIES) {
            logger.error(`${chunkLabel} Failed after ${MAX_RETRIES + 1} attempts: Invalid JSON response`);
            return null;
          }
          logger.error(`${chunkLabel} Invalid JSON response, saved to ${tempJsonFileName}`);
          continue;
        }

        logger.info(`${chunkLabel} Translated successfully (${formatBytes(chunk.byteSize)}, ${chunk.keyCount} keys)`);
        return cleanedText;
      } catch (error) {
        const isLastAttempt = attempt === MAX_RETRIES;
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (isLastAttempt) {
          logger.error(`${chunkLabel} Failed after ${MAX_RETRIES + 1} attempts: ${errorMessage}`);
          return null;
        }

        logger.warn(`${chunkLabel} Attempt ${attempt + 1} failed: ${errorMessage}`);
      }
    }

    return null;
  }

  async translate(): Promise<string> {
    const { systemPrompt, userPrompt } = generatePrompts(this.from, this.to);
    const totalChunks = this.chunks.length;

    logger.info(`Starting translation: ${totalChunks} chunk(s) to process`);

    const results: string[] = [];
    const failedChunks: number[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const chunk = this.chunks[i];

      if (i > 0) {
        logger.info(`Waiting ${INTER_CHUNK_DELAY_MS}ms before next chunk (rate limit protection)...`);
        await delay(INTER_CHUNK_DELAY_MS);
      }

      const result = await this.translateChunk(chunk, systemPrompt, userPrompt);

      if (result) {
        results.push(result);
      } else {
        failedChunks.push(chunk.index + 1);
      }
    }

    if (failedChunks.length > 0) {
      throw new Error(`Translation failed for chunk(s): ${failedChunks.join(', ')}. Check temp files for partial results.`);
    }

    logger.info(`All ${totalChunks} chunk(s) translated successfully, merging results...`);

    const jsonInputs = results.map<JsonObject>((r) => JSON.parse(r));
    const mergedContent = mergeInputs(jsonInputs);

    return JSON.stringify(mergedContent, null, 2);
  }
}

export default Gemini;
