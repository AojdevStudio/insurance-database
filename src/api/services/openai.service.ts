import OpenAI from 'openai';
import { logger } from '../utils/logger.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export class OpenAIService {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second

  private static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async createEmbedding(text: string): Promise<number[]> {
    let retries = 0;
    let lastError: Error | null = null;

    while (retries < this.MAX_RETRIES) {
      try {
        const response = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: text,
          encoding_format: "float"
        });

        return response.data[0].embedding;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.error(`Error generating embedding (attempt ${retries + 1}):`, lastError);
        
        retries++;
        if (retries < this.MAX_RETRIES) {
          await this.sleep(this.RETRY_DELAY * retries);
        }
      }
    }

    throw lastError || new Error('Failed to generate embedding after multiple retries');
  }
} 