/**
 * Generates an embedding for the given text using OpenAI's text-embedding-3-small model
 * @param text - The text to generate an embedding for
 * @returns A Promise that resolves to the embedding vector
 */
export declare function generateEmbedding(text: string): Promise<number[]>;
/**
 * Updates the embedding for a guideline in the database
 * @param guidelineId - The ID of the guideline to update
 * @param content - The content to generate an embedding for
 */
export declare function updateGuidelineEmbedding(guidelineId: number, content: string): Promise<void>;
/**
 * Performs a similarity search on guidelines using the given query
 * @param query - The search query
 * @param limit - Maximum number of results to return (default: 5)
 * @param similarityThreshold - Minimum similarity score to include in results (default: 0.7)
 * @returns A Promise that resolves to an array of matching guidelines
 */
export declare function searchGuidelines(query: string, limit?: number, similarityThreshold?: number): Promise<any>;
