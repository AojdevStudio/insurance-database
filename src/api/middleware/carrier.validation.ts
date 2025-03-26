import { Request, Response, NextFunction } from 'express';
import { query, param, validationResult, ValidationChain } from 'express-validator';
import { RequestHandler } from 'express';

const handleValidationErrors: RequestHandler = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  next();
};

export const validateCarrierSearch: (ValidationChain | RequestHandler)[] = [
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

export const validateCarrierId: (ValidationChain | RequestHandler)[] = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Carrier ID must be a positive integer')
    .toInt(),
  handleValidationErrors
]; 