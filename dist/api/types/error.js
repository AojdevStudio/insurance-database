export class APIError extends Error {
    status;
    code;
    details;
    constructor(message, status, code, details) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
export class ValidationError extends APIError {
    constructor(message, details) {
        super(message, 400, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}
export class NotFoundError extends APIError {
    constructor(message) {
        super(message, 404, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}
//# sourceMappingURL=error.js.map