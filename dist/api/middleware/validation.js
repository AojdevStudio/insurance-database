import { ZodError } from 'zod';
import { ValidationError } from '../types/error.js';
export function validateRequest(schemas) {
    return async (req, res, next) => {
        try {
            if (schemas.params) {
                req.params = await schemas.params.parseAsync(req.params);
            }
            if (schemas.query) {
                req.query = await schemas.query.parseAsync(req.query);
            }
            if (schemas.body) {
                req.body = await schemas.body.parseAsync(req.body);
            }
            next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                const details = error.errors.reduce((acc, err) => {
                    const field = err.path.join('.') || 'general';
                    if (!acc[field]) {
                        acc[field] = [];
                    }
                    acc[field].push(err.message);
                    return acc;
                }, {});
                throw new ValidationError('Validation failed', details);
            }
            next(error);
        }
    };
}
//# sourceMappingURL=validation.js.map