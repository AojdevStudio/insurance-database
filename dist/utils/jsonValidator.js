import { CarrierJSONSchema } from '../types/carrier.js';
import { Logger } from './logging.js';
const logger = new Logger('jsonValidator');
export async function validateJSON(jsonContent) {
    try {
        const jsonData = JSON.parse(jsonContent);
        const result = await CarrierJSONSchema.safeParseAsync(jsonData);
        if (!result.success) {
            const errors = result.error.errors.map((err) => ({
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
    }
    catch (error) {
        const parseError = {
            path: [],
            message: `Failed to parse JSON: ${error.message}`
        };
        logger.error('JSON parsing failed', error, {
            validationError: parseError,
            context: 'jsonValidator.validateJSON'
        });
        return {
            isValid: false,
            errors: [parseError]
        };
    }
}
//# sourceMappingURL=jsonValidator.js.map