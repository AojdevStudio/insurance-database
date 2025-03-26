import fs from 'fs/promises';
import path from 'path';
import { CarrierData } from '../types/document';
import { StateManager } from './state';
import { SchemaValidator } from './validator';
import { DatabaseOperations } from './database';
import { logger } from '../utils/logger';

/**
 * Class for processing JSON insurance data files
 */
export class JsonProcessor {
  private readonly jsonDirectory: string;

  /**
   * Constructor
   * @param jsonDirectory - Directory containing JSON files to process
   */
  constructor(jsonDirectory = './json-files') {
    this.jsonDirectory = jsonDirectory;
    logger.info(`Initialized JSON processor with directory: ${jsonDirectory}`);
  }

  /**
   * Process a single JSON file
   * @param file - Filename to process
   */
  public async processFile(file: string): Promise<void> {
    try {
      logger.info(`Processing file: ${file}`);
      const filePath = path.join(this.jsonDirectory, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Validate JSON structure
      const validation = SchemaValidator.validate(data);
      if (!validation.isValid) {
        throw new Error(`Invalid JSON format in ${file}:\n${validation.errors}`);
      }

      const carrierData = data as CarrierData;
      const carrier = await DatabaseOperations.getOrCreateCarrier(carrierData.provider_name);
      
      for (const doc of carrierData.documents) {
        try {
          await DatabaseOperations.processDocument(carrier, doc);
        } catch (docError) {
          logger.error(`Error processing document ${doc.filename}`, docError as Error);
          // Continue with next document
        }
      }

      await StateManager.updateProcessingState(file);
      logger.info(`Completed processing ${file}`);
    } catch (error) {
      logger.error(`Error processing file ${file}`, error as Error);
      throw error; // Re-throw to handle in main function
    }
  }

  /**
   * Process all JSON files in the configured directory
   */
  public async processAllFiles(): Promise<void> {
    try {
      logger.info(`Processing all JSON files in ${this.jsonDirectory}`);
      const files = await fs.readdir(this.jsonDirectory);
      
      // Filter for JSON files
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      logger.info(`Found ${jsonFiles.length} JSON files to process`);
      
      let processed = 0;
      let skipped = 0;
      let failed = 0;
      
      for (const file of jsonFiles) {
        try {
          // Skip already processed files
          if (await StateManager.isFileProcessed(file)) {
            logger.info(`Skipping already processed file: ${file}`);
            skipped++;
            continue;
          }

          await this.processFile(file);
          processed++;
        } catch (error) {
          logger.error(`Failed to process file ${file}`, error as Error);
          failed++;
          // Continue with next file
        }
      }

      logger.info(`JSON processing completed. Processed: ${processed}, Skipped: ${skipped}, Failed: ${failed}`);
    } catch (error) {
      logger.error('Error processing JSON files', error as Error);
      throw error;
    }
  }
}
