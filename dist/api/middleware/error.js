import { APIError } from '../types/error.js';
import winston from 'winston';
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple(),
        }),
    ],
});
export function errorHandler(err, req, res, next) {
    logger.error('Error handling request:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });
    if (Array.isArray(err)) {
        const response = {
            error: {
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: err.reduce((acc, error) => {
                    const field = error.type === 'field' ? error.path : 'general';
                    if (!acc[field]) {
                        acc[field] = [];
                    }
                    acc[field].push(error.msg);
                    return acc;
                }, {}),
            },
        };
        res.status(400).json(response);
        return;
    }
    if (err instanceof APIError) {
        const response = {
            error: {
                message: err.message,
                code: err.code,
                details: err.details,
            },
        };
        res.status(err.status).json(response);
        return;
    }
    const response = {
        error: {
            message: 'Internal server error',
            code: 'INTERNAL_ERROR',
        },
    };
    res.status(500).json(response);
}
export function notFoundHandler(req, res, next) {
    const err = new APIError('Resource not found', 404, 'NOT_FOUND');
    next(err);
}
//# sourceMappingURL=error.js.map