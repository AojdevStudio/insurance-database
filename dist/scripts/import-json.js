import { readFile } from 'fs/promises';
import { join } from 'path';
import { JsonImporter } from '../importers/json-importer.js';
import { logger } from '../utils/logger.js';
async function main() {
    try {
        const filePath = join(process.cwd(), 'json-files', 'ADDP.json');
        const fileContent = await readFile(filePath, 'utf-8');
        const data = JSON.parse(fileContent);
        const result = await JsonImporter.importCarrierDocument(data);
        logger.info('Successfully imported carrier document:', {
            provider: result.provider_name,
            totalDocuments: result.total_documents,
            firstDocument: result.documents[0]
        });
    }
    catch (error) {
        logger.error('Failed to import carrier document:', error);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=import-json.js.map