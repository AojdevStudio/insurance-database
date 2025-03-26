import { InsuranceRecordSchema, ImportErrorType } from './types.js';
export class JsonValidator {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    validateRecord(record) {
        try {
            const validatedRecord = InsuranceRecordSchema.parse(record);
            return [validatedRecord, null];
        }
        catch (error) {
            const importError = {
                type: ImportErrorType.VALIDATION,
                message: error instanceof Error ? error.message : 'Unknown validation error',
                record: record,
            };
            this.logger.error('Validation error', {
                error: importError,
                record: record,
            });
            return [null, importError];
        }
    }
    validateBatch(records) {
        const validRecords = [];
        const errors = [];
        for (const [index, record] of records.entries()) {
            const [validRecord, error] = this.validateRecord(record);
            if (validRecord) {
                validRecords.push(validRecord);
            }
            if (error) {
                error.line = index + 1;
                errors.push(error);
            }
        }
        return { validRecords, errors };
    }
}
//# sourceMappingURL=validator.js.map