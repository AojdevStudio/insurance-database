import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { ValidationError } from '../types/carrier.js';
export const PageSchema = z.object({
    page_number: z.number(),
    content: z.string()
});
export const MetadataSchema = z.record(z.string().optional());
export const DocumentSchema = z.object({
    filename: z.string(),
    metadata: MetadataSchema,
    total_pages: z.number(),
    pages: z.array(PageSchema)
});
export const CarrierDocumentSchema = z.object({
    provider_name: z.string(),
    processed_date: z.string(),
    total_documents: z.number(),
    documents: z.array(DocumentSchema)
});
export class JsonImporter {
    static async importCarrierDocument(jsonData) {
        try {
            logger.info('Validating carrier document');
            const result = CarrierDocumentSchema.parse(jsonData);
            logger.info(`Successfully validated carrier document for provider ${result.provider_name}`);
            return result;
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
                logger.error(`Validation failed: ${issues}`);
                throw new ValidationError(`Invalid carrier document format: ${issues}`);
            }
            logger.error('Unexpected error during validation', error);
            throw error;
        }
    }
}
//# sourceMappingURL=json-importer.js.map