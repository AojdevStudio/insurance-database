import { z } from 'zod';
export const DEFAULT_IMPORT_CONFIG = {
    batchSize: 100,
    maxMemoryMB: 100,
    progressUpdateInterval: 100,
    maxFileSize: 1024 * 1024 * 1024,
};
export var ImportStatus;
(function (ImportStatus) {
    ImportStatus["PENDING"] = "PENDING";
    ImportStatus["IN_PROGRESS"] = "IN_PROGRESS";
    ImportStatus["COMPLETED"] = "COMPLETED";
    ImportStatus["FAILED"] = "FAILED";
    ImportStatus["CANCELLED"] = "CANCELLED";
})(ImportStatus || (ImportStatus = {}));
export var ImportErrorType;
(function (ImportErrorType) {
    ImportErrorType["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ImportErrorType["PARSING_ERROR"] = "PARSING_ERROR";
    ImportErrorType["MEMORY_ERROR"] = "MEMORY_ERROR";
    ImportErrorType["FILE_ERROR"] = "FILE_ERROR";
    ImportErrorType["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(ImportErrorType || (ImportErrorType = {}));
export const InsuranceRecordSchema = z.object({
    id: z.string().optional(),
    carrierName: z.string().min(1, 'Carrier name is required'),
    policyType: z.string().min(1, 'Policy type is required'),
    coverageDetails: z.string(),
    effectiveDate: z.date(),
    expirationDate: z.date(),
    premium: z.number().positive('Premium must be positive'),
    status: z.string().min(1, 'Status is required'),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
}).refine((data) => data.effectiveDate < data.expirationDate, 'Effective date must be before expiration date');
export var ImportEventType;
(function (ImportEventType) {
    ImportEventType["PROGRESS_UPDATE"] = "PROGRESS_UPDATE";
    ImportEventType["ERROR"] = "ERROR";
    ImportEventType["COMPLETE"] = "COMPLETE";
    ImportEventType["CANCELLED"] = "CANCELLED";
})(ImportEventType || (ImportEventType = {}));
//# sourceMappingURL=types.js.map