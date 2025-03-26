import Ajv, { JSONSchemaType } from 'ajv';
import { CarrierData } from '../types/document';
import { logger } from '../utils/logger';

/**
 * Schema validator for insurance carrier data
 */
export class SchemaValidator {
  private static readonly ajv = new Ajv();
  private static validator: ReturnType<typeof Ajv.prototype.compile<CarrierData>> | null = null;

  /**
   * Initialize the schema validator
   */
  private static initialize(): void {
    if (this.validator) return;
    
    const jsonSchema: JSONSchemaType<CarrierData> = {
      type: 'object',
      required: ['provider_name', 'documents'],
      properties: {
        provider_name: { type: 'string' },
        documents: {
          type: 'array',
          items: {
            type: 'object',
            required: ['filename', 'total_pages'],
            properties: {
              filename: { type: 'string' },
              total_pages: { type: 'integer', minimum: 0 },
              metadata: { 
                type: 'object',
                additionalProperties: true
              },
              pages: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['page_number', 'content'],
                  properties: {
                    page_number: { type: 'integer', minimum: 1 },
                    content: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    };

    this.validator = this.ajv.compile(jsonSchema);
    logger.info('JSON schema validator initialized');
  }

  /**
   * Validate carrier data against JSON schema
   * @param data - The data to validate
   * @returns Validation result
   */
  public static validate(data: unknown): { isValid: boolean; errors: string | null } {
    this.initialize();
    
    if (!this.validator) {
      throw new Error('Validator not initialized');
    }
    
    const isValid = this.validator(data);
    
    if (!isValid) {
      const errors = this.validator.errors
        ? this.validator.errors.map(err => 
            `${err.instancePath} ${err.message}`
          ).join('\n')
        : 'Unknown validation error';
        
      logger.error(`JSON validation failed: ${errors}`);
      return { isValid: false, errors };
    }
    
    logger.info('JSON validation passed');
    return { isValid: true, errors: null };
  }
}
