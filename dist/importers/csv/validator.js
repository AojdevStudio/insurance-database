import { z } from 'zod';
import { InsuranceRecordSchema, ImportErrorType, DEFAULT_IMPORT_CONFIG, } from './types.js';
import { logError, logDebug } from './logger.js';
export const CSVRowSchema = z.object({
    ...InsuranceRecordSchema.shape,
    _rowNumber: z.number().int().positive(),
    _raw: z.record(z.string(), z.unknown()),
});
export const validateRow = async (row, rowNumber, options = {}) => {
    try {
        const enrichedRow = {
            ...row,
            _rowNumber: rowNumber,
            _raw: { ...row },
            effectiveDate: row.effectiveDate ? new Date(row.effectiveDate) : undefined,
            expirationDate: row.expirationDate ? new Date(row.expirationDate) : undefined,
        };
        const validatedData = await CSVRowSchema.parseAsync(enrichedRow);
        return {
            valid: true,
            data: validatedData,
        };
    }
    catch (error) {
        const importError = {
            type: ImportErrorType.VALIDATION_ERROR,
            message: error instanceof Error ? error.message : 'Unknown validation error',
            row: rowNumber,
            originalValue: row,
        };
        logError(importError);
        return {
            valid: false,
            error: importError,
        };
    }
};
export const validateBatch = async (rows, startRow, options = {}) => {
    const batchSize = options.batchSize || DEFAULT_IMPORT_CONFIG.batchSize;
    const results = await Promise.all(rows.slice(0, batchSize).map((row, index) => validateRow(row, startRow + index, options)));
    const validRows = results
        .filter((result) => result.valid && result.data !== undefined)
        .map(result => result.data);
    const errors = results
        .filter((result) => !result.valid && result.error !== undefined)
        .map(result => result.error);
    logDebug('Batch validation complete', {
        batchSize: rows.length,
        validCount: validRows.length,
        errorCount: errors.length,
    });
    return {
        valid: errors.length === 0,
        validRows,
        errors,
    };
};
export const validateHeaders = (headers, options = {}) => {
    const requiredColumns = options.requiredColumns || [
        'carrierName',
        'policyType',
        'coverageDetails',
        'effectiveDate',
        'expirationDate',
        'premium',
        'status',
    ];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    if (missingColumns.length > 0) {
        const error = {
            type: ImportErrorType.VALIDATION_ERROR,
            message: `Missing required columns: ${missingColumns.join(', ')}`,
            column: missingColumns.join(', '),
        };
        logError(error);
        return { valid: false, error };
    }
    if (!options.allowUnknownColumns) {
        const unknownColumns = headers.filter(col => !requiredColumns.includes(col) && !['id', 'createdAt', 'updatedAt'].includes(col));
        if (unknownColumns.length > 0) {
            const error = {
                type: ImportErrorType.VALIDATION_ERROR,
                message: `Unknown columns found: ${unknownColumns.join(', ')}`,
                column: unknownColumns.join(', '),
            };
            logError(error);
            return { valid: false, error };
        }
    }
    return { valid: true };
};
//# sourceMappingURL=validator.js.map