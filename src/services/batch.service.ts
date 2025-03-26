/// <reference types="node" />
import { Logger } from '../utils/logging.js';

export class BatchService<T, R> {
  private batches: Map<string, T[]>;
  private logger: Logger;

  constructor() {
    this.batches = new Map();
    this.logger = new Logger('batch-service');
  }

  /**
   * Add an item to a batch
   * @param key The batch key
   * @param item The item to add
   */
  public async addToBatch(key: string, item: T): Promise<void> {
    try {
      if (!this.batches.has(key)) {
        this.batches.set(key, []);
      }
      this.batches.get(key)!.push(item);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error adding item to batch', err);
      throw err;
    }
  }

  /**
   * Get the size of a batch
   * @param key The batch key
   * @returns The number of items in the batch
   */
  public getBatchSize(key: string): number {
    return this.batches.get(key)?.length || 0;
  }

  /**
   * Get all items in a batch
   * @param key The batch key
   * @returns Array of batch items
   */
  public getBatchItems(key: string): T[] {
    return this.batches.get(key) || [];
  }

  /**
   * Process a batch of items
   * @param items The items to process
   * @returns Array of results
   */
  public async processBatch(items: T[]): Promise<R[]> {
    try {
      // This is a base implementation that should be overridden
      // by specific batch processors
      return items.map(() => ({} as R));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error processing batch', err);
      throw err;
    }
  }

  /**
   * Clear a batch
   * @param key The batch key
   */
  public async clearBatch(key: string): Promise<void> {
    try {
      this.batches.delete(key);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error clearing batch', err);
      throw err;
    }
  }
} 