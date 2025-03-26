import { readFile } from 'fs/promises';
import { join } from 'path';
import { JsonImporter } from '../importers/json-importer.js';
import { logger } from '../utils/logger.js';
async function main() {
    try {
        const filePath = join(process.cwd(), 'json-files', 'ADDP.json');
        const fileContent = await readFile(filePath, 'utf-8');
        const jsonData = JSON.parse(fileContent);
        const carrierDoc = await JsonImporter.importCarrierDocument(jsonData);
        logger.info('Successfully imported carrier document:');
        logger.info(`Provider: ${carrierDoc.provider_name}`);
        logger.info(`Total Documents: ${carrierDoc.total_documents}`);
        logger.info(`First Document: ${carrierDoc.documents[0].filename}`);
        logger.info(`First Document Pages: ${carrierDoc.documents[0].total_pages}`);
    }
    catch (error) {
        logger.error('Failed to import carrier document:', error);
        process.exit(1);
    }
}
main().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
});
//# sourceMappingURL=import-test.js.map