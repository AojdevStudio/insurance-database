import { AuthenticationError } from '../../errors/authentication.error.js';
import { logger } from '../../utils/logger.js';
export function validateApiKey(apiKeyService) {
    return async (req, res, next) => {
        try {
            const apiKey = req.header('X-API-Key');
            if (!apiKey) {
                throw new AuthenticationError('API key is required');
            }
            const validation = await apiKeyService.validateKey(apiKey);
            if (!validation.isValid || !validation.keyId || !validation.permissions) {
                throw new AuthenticationError('Invalid API key');
            }
            const endpoint = req.path;
            if (!validation.permissions.allowedEndpoints.includes('*') &&
                !validation.permissions.allowedEndpoints.includes(endpoint)) {
                throw new AuthenticationError('API key does not have permission for this endpoint');
            }
            req.apiKey = {
                id: validation.keyId,
                permissions: validation.permissions
            };
            next();
        }
        catch (error) {
            logger.error('API key validation failed', { error });
            next(error);
        }
    };
}
//# sourceMappingURL=auth.js.map