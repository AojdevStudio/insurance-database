import { CarrierJSONSchema, ValidationResult, JSONValidationError } from '../types/carrier.js';
import { Logger } from './logging.js';
import { ZodError } from 'zod';

const logger = new Logger('jsonValidator');

/**
 * Validates a JSON string against the carrier schema
 * @param jsonContent - The JSON content as a string
 * @returns Promise<ValidationResult> - The validation result containing errors if any
 */
export async function validateJSON(jsonContent: string): Promise<ValidationResult> {
  try {
    // Parse JSON string
    const jsonData = JSON.parse(jsonContent);

    // Validate against schema
    const result = await CarrierJSONSchema.safeParseAsync(jsonData);

    if (!result.success) {
      const errors: JSONValidationError[] = result.error.errors.map((err: ZodError['errors'][0]) => ({
        path: err.path.map(p => String(p)),
        message: err.message
      }));

      const validationError = new Error('JSON validation failed');
      validationError.name = 'ValidationError';
      logger.error('JSON validation failed', validationError, {
        validationErrors: errors,
        context: 'jsonValidator.validateJSON'
      });

      return {
        isValid: false,
        errors
      };
    }

    logger.info('JSON validation successful', {
      carrier_name: result.data.carrier_name,
      context: 'jsonValidator.validateJSON'
    });

    return {
      isValid: true,
      errors: [],
      data: result.data
    };
  } catch (error) {
    const parseError: JSONValidationError = {
      path: [],
      message: `Failed to parse JSON: ${(error as Error).message}`
    };

    logger.error('JSON parsing failed', error as Error, {
      validationError: parseError,
      context: 'jsonValidator.validateJSON'
    });

    return {
      isValid: false,
      errors: [parseError]
    };
  }
} 