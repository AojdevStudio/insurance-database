import { JsonParser } from '../parser.js';
import { createLogger } from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
describe('JsonParser Performance', () => {
    const logger = createLogger({ silent: true });
    const largeSamplePath = path.join(__dirname, 'data', 'large_sample.json');
    beforeAll(async () => {
        const records = Array.from({ length: 10000 }, (_, i) => ({
            carrier: `Carrier ${i}`,
            policy_type: i % 2 === 0 ? 'auto' : 'home',
            coverage_limits: 50000 + (i * 1000),
            premium: 1000 + (i * 10),
            effective_date: new Date(2024, 0, 1).toISOString(),
            expiration_date: new Date(2024, 11, 31).toISOString(),
            status: 'active',
            metadata: {
                record_number: i,
                generated: true
            }
        }));
        await fs.writeFile(largeSamplePath, JSON.stringify({ records }, null, 2), 'utf-8');
    });
    afterAll(async () => {
        await fs.unlink(largeSamplePath);
    });
    it('should process large files efficiently', async () => {
        const parser = new JsonParser(logger, {
            batchSize: 100,
            maxMemoryMB: 100,
            progressInterval: 1000
        });
        const startTime = Date.now();
        const stats = await parser.parseFile(largeSamplePath);
        const duration = Date.now() - startTime;
        expect(stats.totalRecords).toBe(10000);
        expect(stats.processedRecords).toBe(10000);
        expect(stats.errorCount).toBe(0);
        expect(stats.memoryUsage).toBeLessThan(100);
        expect(duration).toBeLessThan(5000);
        const recordsPerSecond = stats.totalRecords / (duration / 1000);
        expect(recordsPerSecond).toBeGreaterThan(2000);
    });
    it('should maintain consistent memory usage', async () => {
        const parser = new JsonParser(logger, {
            batchSize: 100,
            maxMemoryMB: 100,
            progressInterval: 1000
        });
        const memoryReadings = [];
        parser.on('progress', (stats) => {
            memoryReadings.push(stats.memoryUsage);
        });
        await parser.parseFile(largeSamplePath);
        const memoryVariance = calculateVariance(memoryReadings);
        expect(memoryVariance).toBeLessThan(10);
    });
});
function calculateVariance(numbers) {
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const squaredDiffs = numbers.map(num => Math.pow(num - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((sum, diff) => sum + diff, 0) / numbers.length);
}
//# sourceMappingURL=performance.test.js.map