import { query, param, validationResult } from 'express-validator';
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
    }
    next();
};
export const validateCarrierSearch = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer')
        .toInt(),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
        .toInt(),
    query('sort_by')
        .optional()
        .isIn(['name', 'created_at'])
        .withMessage('Sort by must be either name or created_at'),
    query('sort_order')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Sort order must be either asc or desc'),
    handleValidationErrors
];
export const validateCarrierId = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('Carrier ID must be a positive integer')
        .toInt(),
    handleValidationErrors
];
//# sourceMappingURL=carrier.validation.js.map