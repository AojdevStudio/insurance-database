import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
const MetadataSchema = z.object({
    filename: z.string(),
    title: z.string(),
    date: z.string().optional(),
    type: z.string().optional(),
    category: z.string().optional()
});
const PageSchema = z.object({
    page_number: z.number(),
    content: z.string()
});
const DocumentSchema = z.object({
    filename: z.string(),
    metadata: MetadataSchema,
    pages: z.array(PageSchema)
});
const CarrierDocumentSchema = z.object({
    provider_name: z.string(),
    processed_date: z.string(),
    total_documents: z.number(),
    documents: z.array(DocumentSchema)
});
class JsonImporter {
    async importCarrierDocument(data) {
        try {
            console.log('Validating carrier document...');
            const validatedData = CarrierDocumentSchema.parse(data);
            console.log('Validation successful');
            return validatedData;
        }
        catch (error) {
            console.error('Validation failed:', error);
            throw error;
        }
    }
}
async function main() {
    try {
        const jsonPath = join(process.cwd(), 'json-files', 'ADDP.json');
        const jsonContent = await readFile(jsonPath, 'utf-8');
        const data = JSON.parse(jsonContent);
        const importer = new JsonImporter();
        const result = await importer.importCarrierDocument(data);
        console.log('Import successful!');
        console.log('Provider:', result.provider_name);
        console.log('Total documents:', result.total_documents);
        if (result.documents.length > 0) {
            console.log('First document filename:', result.documents[0].filename);
            console.log('First document total pages:', result.documents[0].pages.length);
            console.log('First page preview:', result.documents[0].pages[0].content.slice(0, 100) + '...');
        }
    }
    catch (error) {
        console.error('Import failed:', error);
    }
}
main();
//# sourceMappingURL=import-json.mjs.map