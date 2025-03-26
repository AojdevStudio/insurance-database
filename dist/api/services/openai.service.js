import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});
export class OpenAIService {
    static MAX_RETRIES = 3;
    static RETRY_DELAY = 1000;
    static async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    static async createEmbedding(text) {
        let retries = 0;
        let lastError = null;
        while (retries < this.MAX_RETRIES) {
            try {
                const response = await openai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: text,
                    encoding_format: "float"
                });
                return response.data[0].embedding;
            }
            catch (error) {
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
//# sourceMappingURL=openai.service.js.map