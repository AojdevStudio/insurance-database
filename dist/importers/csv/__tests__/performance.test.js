import { CSVParser } from '../parser.js';
import { ImportStatus } from '../types.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDataDir = path.join(__dirname, 'data');
const largeFilePath = path.join(testDataDir, 'large-test.csv');
async function generateLargeCSVFile(rowCount, filePath) {
    const writeStream = createWriteStream(filePath);
    const headers = 'carrierName,policyType,coverageDetails,effectiveDate,expirationDate,premium,status\n';
    await new Promise((resolve, reject) => {
        writeStream.write(headers, 'utf8');
        const carriers = ['ABC Insurance', 'XYZ Insurance', 'DEF Insurance'];
        const policyTypes = ['Auto', 'Home', 'Life', 'Health'];
        const coverages = ['Basic', 'Standard', 'Premium', 'Comprehensive'];
        const statuses = ['Active', 'Pending', 'Renewed'];
        let rowsWritten = 0;
        function writeNextBatch() {
            let canContinue = true;
            const batchSize = 1000;
            for (let i = 0; i < batchSize && rowsWritten < rowCount; i++) {
                const row = [
                    carriers[rowsWritten % carriers.length],
                    policyTypes[rowsWritten % policyTypes.length],
                    `${coverages[rowsWritten % coverages.length]} Coverage`,
                    new Date(2024, 0, 1 + rowsWritten % 365).toISOString().split('T')[0],
                    new Date(2025, 0, 1 + rowsWritten % 365).toISOString().split('T')[0],
                    (1000 + (rowsWritten % 9) * 100).toFixed(2),
                    statuses[rowsWritten % statuses.length],
                ].join(',') + '\n';
                canContinue = writeStream.write(row, 'utf8');
                rowsWritten++;
            }
            if (rowsWritten < rowCount) {
                if (!canContinue) {
                    writeStream.once('drain', writeNextBatch);
                }
                else {
                    process.nextTick(writeNextBatch);
                }
            }
            else {
                writeStream.end();
            }
        }
        writeNextBatch();
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
    });
}
describe('CSV Parser Performance', () => {
    const ROW_COUNT = 100000;
    const LARGE_ROW_COUNT = 1000000;
    beforeAll(async () => {
        await fs.mkdir(testDataDir, { recursive: true });
        if (!(await fs.stat(largeFilePath).catch(() => false))) {
            await generateLargeCSVFile(ROW_COUNT, largeFilePath);
        }
    }, 30000);
    it('should meet basic performance requirements', async () => {
        const parser = new CSVParser();
        const startTime = Date.now();
        const result = await parser.parseFile(largeFilePath);
        expect(result.success).toBe(true);
        expect(result.progress.status).toBe(ImportStatus.COMPLETED);
        expect(result.progress.totalRows).toBe(ROW_COUNT);
        expect(result.progress.processedRows).toBe(ROW_COUNT);
        const rowsPerSecond = result.performance.rowsPerSecond;
        expect(rowsPerSecond).toBeGreaterThan(10000);
        const memoryUsageMB = result.performance.peakMemoryUsage / (1024 * 1024);
        expect(memoryUsageMB).toBeLessThan(100);
        const errorRate = (result.progress.failedRows / result.progress.totalRows) * 100;
        expect(errorRate).toBeLessThan(0.1);
    }, 60000);
    it('should handle large files efficiently', async () => {
        const largeFilePath2 = path.join(testDataDir, 'very-large-test.csv');
        await generateLargeCSVFile(LARGE_ROW_COUNT, largeFilePath2);
        const parser = new CSVParser({
            batchSize: 1000,
            progressUpdateInterval: 10000,
        });
        const result = await parser.parseFile(largeFilePath2);
        expect(result.success).toBe(true);
        expect(result.progress.status).toBe(ImportStatus.COMPLETED);
        expect(result.progress.totalRows).toBe(LARGE_ROW_COUNT);
        expect(result.progress.processedRows).toBe(LARGE_ROW_COUNT);
        const memoryUsageMB = result.performance.peakMemoryUsage / (1024 * 1024);
        expect(memoryUsageMB).toBeLessThan(100);
        await fs.unlink(largeFilePath2);
    }, 300000);
    it('should maintain consistent processing speed', async () => {
        const parser = new CSVParser({
            progressUpdateInterval: 10000,
        });
        const speedMeasurements = [];
        const progressHandler = (progress) => {
            speedMeasurements.push(progress.rowsPerSecond);
        };
        jest.spyOn(console, 'log').mockImplementation((message) => {
            if (message.includes('performance')) {
                progressHandler(JSON.parse(message).performance);
            }
        });
        await parser.parseFile(largeFilePath);
        const avgSpeed = speedMeasurements.reduce((a, b) => a + b, 0) / speedMeasurements.length;
        const maxDeviation = Math.max(...speedMeasurements.map(speed => Math.abs(speed - avgSpeed) / avgSpeed));
        expect(maxDeviation).toBeLessThan(0.5);
    }, 60000);
    afterAll(async () => {
        await fs.unlink(largeFilePath).catch(() => { });
    });
});
//# sourceMappingURL=performance.test.js.map