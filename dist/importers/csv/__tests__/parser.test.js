import { CSVParser } from '../parser.js';
import { ImportStatus, ImportErrorType } from '../types.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDataDir = path.join(__dirname, 'data');
const sampleFilePath = path.join(testDataDir, 'sample.csv');
describe('CSV Parser', () => {
    beforeAll(async () => {
        await fs.mkdir(testDataDir, { recursive: true });
    });
    describe('parseFile', () => {
        it('should parse valid CSV file successfully', async () => {
            const parser = new CSVParser();
            const result = await parser.parseFile(sampleFilePath);
            expect(result.success).toBe(false);
            expect(result.progress.status).toBe(ImportStatus.COMPLETED);
            expect(result.progress.totalRows).toBe(5);
            expect(result.progress.processedRows).toBe(4);
            expect(result.progress.failedRows).toBe(1);
            expect(result.errors.length).toBe(1);
            expect(result.performance).toBeDefined();
            expect(result.performance.rowsPerSecond).toBeGreaterThan(0);
        });
        it('should handle missing file', async () => {
            const parser = new CSVParser();
            await expect(parser.parseFile('nonexistent.csv')).rejects.toThrow();
        });
        it('should respect batch size configuration', async () => {
            const parser = new CSVParser({ batchSize: 2 });
            const result = await parser.parseFile(sampleFilePath);
            expect(result.progress.totalRows).toBe(5);
            expect(result.progress.currentBatch).toBeGreaterThan(2);
        });
        it('should validate headers', async () => {
            const invalidHeadersFile = path.join(testDataDir, 'invalid-headers.csv');
            await fs.writeFile(invalidHeadersFile, 'invalid1,invalid2\na,b');
            const parser = new CSVParser();
            const result = await parser.parseFile(invalidHeadersFile);
            expect(result.success).toBe(false);
            expect(result.errors[0].type).toBe(ImportErrorType.VALIDATION_ERROR);
            expect(result.errors[0].message).toContain('Missing required columns');
            await fs.unlink(invalidHeadersFile);
        });
        it('should track memory usage', async () => {
            const parser = new CSVParser();
            const result = await parser.parseFile(sampleFilePath);
            expect(result.performance.peakMemoryUsage).toBeGreaterThan(0);
            expect(result.performance.peakMemoryUsage).toBeLessThan(100 * 1024 * 1024);
        });
        it('should emit progress updates at configured intervals', async () => {
            const parser = new CSVParser({ progressUpdateInterval: 2 });
            const progressUpdates = [];
            jest.spyOn(console, 'log').mockImplementation((message) => {
                if (message.includes('progress')) {
                    progressUpdates.push(JSON.parse(message).progress.processedRows);
                }
            });
            await parser.parseFile(sampleFilePath);
            expect(progressUpdates.length).toBeGreaterThan(0);
            progressUpdates.forEach(update => {
                expect(update % 2).toBe(0);
            });
        });
    });
    describe('error handling', () => {
        it('should handle malformed CSV data', async () => {
            const malformedFile = path.join(testDataDir, 'malformed.csv');
            await fs.writeFile(malformedFile, 'header1,header2\nvalue1,"unclosed quote\nvalue3,value4');
            const parser = new CSVParser();
            const result = await parser.parseFile(malformedFile);
            expect(result.success).toBe(false);
            expect(result.errors[0].type).toBe(ImportErrorType.PARSING_ERROR);
            await fs.unlink(malformedFile);
        });
        it('should handle empty file', async () => {
            const emptyFile = path.join(testDataDir, 'empty.csv');
            await fs.writeFile(emptyFile, '');
            const parser = new CSVParser();
            const result = await parser.parseFile(emptyFile);
            expect(result.success).toBe(false);
            expect(result.progress.totalRows).toBe(0);
            await fs.unlink(emptyFile);
        });
    });
});
//# sourceMappingURL=parser.test.js.map