import fs from 'fs/promises';
import { ProcessingState } from '../types/document';
import { logger } from '../utils/logger';

/**
 * Class for managing document processing state
 */
export class StateManager {
  private static readonly STATE_FILE = '.processing_state.json';

  /**
   * Load the current processing state
   * @returns The current processing state
   */
  public static async loadProcessingState(): Promise<ProcessingState> {
    try {
      const state = await fs.readFile(this.STATE_FILE, 'utf-8');
      return JSON.parse(state) as ProcessingState;
    } catch (error) {
      logger.info('No existing state file found, creating new state');
      return { processedFiles: [], lastProcessedTime: null };
    }
  }

  /**
   * Update the processing state with a newly processed file
   * @param filename - The name of the processed file
   */
  public static async updateProcessingState(filename: string): Promise<void> {
    const state = await this.loadProcessingState();
    
    // Only add the filename if it's not already in the list
    if (!state.processedFiles.includes(filename)) {
      state.processedFiles.push(filename);
    }
    
    state.lastProcessedTime = new Date().toISOString();
    await fs.writeFile(this.STATE_FILE, JSON.stringify(state, null, 2));
    logger.info(`Updated processing state with file: ${filename}`);
  }

  /**
   * Check if a file has already been processed
   * @param filename - The name of the file to check
   * @returns True if the file has been processed
   */
  public static async isFileProcessed(filename: string): Promise<boolean> {
    const state = await this.loadProcessingState();
    return state.processedFiles.includes(filename);
  }
}
