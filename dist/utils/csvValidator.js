import { parse } from 'csv-parse';
import { Readable } from 'stream';
export var PlanType;
(function (PlanType) {
    PlanType["PPO"] = "PPO";
    PlanType["HMO"] = "HMO";
    PlanType["EPO"] = "EPO";
})(PlanType || (PlanType = {}));
export class CSVParsingError extends Error {
    code;
    lines;
    constructor(message, code, lines) {
        super(message);
        this.code = code;
        this.lines = lines;
        this.name = 'CSVParsingError';
    }
}
const REQUIRED_COLUMNS = ['carrier_name', 'network_name', 'plan_type', 'effective_date'];
const VALID_PLAN_TYPES = Object.values(PlanType);
const MAX_FIELD_LENGTHS = {
    carrier_name: 100,
    network_name: 100,
    plan_type: 10,
};
function isCSVParsingError(error) {
    return error instanceof CSVParsingError ||
        (error instanceof Error && 'code' in error && 'lines' in error);
}
export async function validateCSV(csvContent) {
    const errors = [];
    const data = [];
    const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length === 0) {
        return {
            isValid: false,
            errors: [{
                    row: 0,
                    type: 'COLUMN_COUNT_MISMATCH',
                    message: 'CSV file is empty'
                }]
        };
    }
    const headerValidation = validateHeaders(lines[0]);
    if (!headerValidation.isValid) {
        return headerValidation;
    }
    const headerColumns = lines[0].split(',').map(h => h.trim());
    for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(',').map(c => c.trim());
        if (columns.length !== headerColumns.length) {
            return {
                isValid: false,
                errors: [{
                        row: i + 1,
                        type: 'COLUMN_COUNT_MISMATCH',
                        message: `Row has ${columns.length} columns but header has ${headerColumns.length} columns`
                    }]
            };
        }
    }
    const stream = Readable.from([csvContent]);
    try {
        const parser = stream.pipe(parse({
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_column_count: false
        }));
        for await (const record of parser) {
            const rowIndex = data.length + 1;
            const rowErrors = validateRow(record, rowIndex);
            if (rowErrors.length > 0) {
                errors.push(...rowErrors);
            }
            data.push(record);
        }
        return {
            isValid: errors.length === 0,
            errors,
            data: errors.length === 0 ? data : undefined
        };
    }
    catch (error) {
        if (isCSVParsingError(error)) {
            const errorLine = error.lines || 0;
            return {
                isValid: false,
                errors: [{
                        row: errorLine,
                        type: 'COLUMN_COUNT_MISMATCH',
                        message: `Row has inconsistent number of columns`
                    }]
            };
        }
        return {
            isValid: false,
            errors: [{
                    row: 0,
                    type: 'COLUMN_COUNT_MISMATCH',
                    message: 'Failed to parse CSV: ' + (error instanceof Error ? error.message : String(error))
                }]
        };
    }
}
function validateHeaders(headerRow) {
    const headers = headerRow.split(',').map(h => h.trim());
    const errors = [];
    for (const required of REQUIRED_COLUMNS) {
        if (!headers.includes(required)) {
            errors.push({
                row: 0,
                type: 'MISSING_REQUIRED_COLUMN',
                message: `Required column "${required}" is missing`
            });
        }
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}
function validateRow(record, rowIndex) {
    const errors = [];
    for (const [field, maxLength] of Object.entries(MAX_FIELD_LENGTHS)) {
        const fieldName = field;
        const value = record[fieldName];
        if (typeof value === 'string' && value.length > maxLength) {
            errors.push({
                row: rowIndex,
                type: 'INVALID_FIELD_LENGTH',
                message: `${field} exceeds maximum length of ${maxLength} characters`
            });
        }
    }
    for (const field of REQUIRED_COLUMNS) {
        const value = record[field];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
            errors.push({
                row: rowIndex,
                type: 'EMPTY_REQUIRED_FIELD',
                message: `Required field "${field}" is empty`
            });
        }
    }
    const planType = record.plan_type;
    if (planType && !VALID_PLAN_TYPES.includes(planType)) {
        errors.push({
            row: rowIndex,
            type: 'INVALID_ENUM_VALUE',
            message: `Invalid plan_type value. Expected one of: ${VALID_PLAN_TYPES.join(', ')}`
        });
    }
    if (record.effective_date) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(record.effective_date)) {
            errors.push({
                row: rowIndex,
                type: 'INVALID_DATE_FORMAT',
                message: 'Invalid date format in column "effective_date". Expected YYYY-MM-DD'
            });
        }
        else {
            const date = new Date(record.effective_date);
            if (isNaN(date.getTime())) {
                errors.push({
                    row: rowIndex,
                    type: 'INVALID_DATE_FORMAT',
                    message: 'Invalid date value in column "effective_date"'
                });
            }
        }
    }
    return errors;
}
//# sourceMappingURL=csvValidator.js.map