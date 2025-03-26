import { JsonParser } from '../parser.js';
import { createLogger } from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import { ImportErrorType } from '../types.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
describe('JsonParser', () => {
    const logger = createLogger({ silent: true });
    const sampleFilePath = path.join(__dirname, 'data', 'sample.json');
    let parser;
    beforeEach(() => {
        parser = new JsonParser(logger, {
            batchSize: 1,
            maxMemoryMB: 100,
            progressInterval: 1
        });
    });
    it('should parse valid JSON file successfully', async () => {
        const recordsReceived = [];
        const errorsReceived = [];
        let progressUpdates = 0;
        parser.on('records', (records) => recordsReceived.push(...records));
        parser.on('errors', (errors) => errorsReceived.push(...errors));
        parser.on('progress', () => progressUpdates++);
        const stats = await parser.parseFile(sampleFilePath);
        expect(stats.totalRecords).toBe(2);
        expect(stats.processedRecords).toBe(2);
        expect(stats.errorCount).toBe(0);
        expect(recordsReceived.length).toBe(2);
        expect(errorsReceived.length).toBe(0);
        expect(progressUpdates).toBeGreaterThan(0);
        expect(stats.endTime).toBeDefined();
    });
    it('should handle memory limits', async () => {
        const parserWithLowMemory = new JsonParser(logger, {
            maxMemoryMB: 0.000001
        });
        let errorReceived = false;
        parserWithLowMemory.on('error', (error) => {
            if (error.type === ImportErrorType.MEMORY) {
                errorReceived = true;
            }
        });
        try {
            await parserWithLowMemory.parseFile(sampleFilePath);
        }
        catch (error) {
            expect(error).toBeDefined();
        }
        expect(errorReceived).toBe(true);
    });
    it('should handle invalid JSON gracefully', async () => {
        const invalidFilePath = path.join(__dirname, 'data', 'invalid.json');
        await import('fs').then(fs => fs.promises.writeFile(invalidFilePath, '{ invalid json', 'utf-8'));
        try {
            await parser.parseFile(invalidFilePath);
            expect(true).toBe(false);
        }
        catch (error) {
            expect(error).toBeDefined();
        }
        finally {
            await import('fs').then(fs => fs.promises.unlink(invalidFilePath));
        }
    });
});
//# sourceMappingURL=parser.test.js.map