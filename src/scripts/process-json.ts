#!/usr/bin/env node

import { JsonProcessor } from '../processors/json-processor';
import { logger } from '../utils/logger';

/**
 * Main entry point for processing JSON files
 */
async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    
    // Check for a specific file to process
    let singleFile: string | null = null;
    let jsonDirectory = './json-files';
    
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--file' && i + 1 < args.length) {
        singleFile = args[i + 1];
        i++;
      } else if (args[i] === '--dir' && i + 1 < args.length) {
        jsonDirectory = args[i + 1];
        i++;
      }
    }
    
    logger.info('Starting JSON data processing');
    const processor = new JsonProcessor(jsonDirectory);
    
    if (singleFile) {
      logger.info(`Processing single file: ${singleFile}`);
      await processor.processFile(singleFile);
    } else {
      logger.info('Processing all JSON files');
      await processor.processAllFiles();
    }
    
    logger.info('JSON data processing completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error in JSON data processing', error as Error);
    process.exit(1);
  }
}

// Run the main function
main();
