import { GuidelineService } from '../guidelines.service.js';
import { performance } from 'perf_hooks';
async function runBenchmark(method, searchFn, runs = 10) {
    const times = [];
    let totalResults = 0;
    let cacheHits = 0;
    for (let i = 0; i < runs; i++) {
        const start = performance.now();
        const result = await searchFn();
        const end = performance.now();
        times.push(end - start);
        totalResults += result.guidelines.length;
        if ((end - start) < 50) {
            cacheHits++;
        }
    }
    return {
        method,
        averageTime: times.reduce((a, b) => a + b, 0) / times.length,
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
        totalRuns: runs,
        cacheHitRate: cacheHits / runs,
        averageResultCount: totalResults / runs
    };
}
export async function runSearchBenchmarks() {
    const testQueries = [
        'insurance approval process',
        'prior authorization requirements',
        'claim submission guidelines',
        'network participation rules',
        'coverage determination process'
    ];
    const methods = ['text', 'semantic', 'hybrid', 'rrf_hybrid'];
    const results = [];
    console.log('Starting search benchmarks...\n');
    for (const query of testQueries) {
        console.log(`Testing query: "${query}"`);
        for (const method of methods) {
            const result = await runBenchmark(method, () => GuidelineService.search({
                query,
                search_type: method,
                limit: 10
            }));
            results.push(result);
            console.log(`\n${method.toUpperCase()} Search Results:`);
            console.log(`Average time: ${result.averageTime.toFixed(2)}ms`);
            console.log(`Min time: ${result.minTime.toFixed(2)}ms`);
            console.log(`Max time: ${result.maxTime.toFixed(2)}ms`);
            console.log(`Cache hit rate: ${(result.cacheHitRate * 100).toFixed(1)}%`);
            console.log(`Average results: ${result.averageResultCount.toFixed(1)}`);
        }
        console.log('\n---\n');
    }
    const aggregated = methods.map(method => {
        const methodResults = results.filter(r => r.method === method);
        return {
            method,
            averageTime: methodResults.reduce((a, b) => a + b.averageTime, 0) / methodResults.length,
            cacheHitRate: methodResults.reduce((a, b) => a + b.cacheHitRate, 0) / methodResults.length,
            averageResultCount: methodResults.reduce((a, b) => a + b.averageResultCount, 0) / methodResults.length
        };
    });
    console.log('Overall Results:\n');
    aggregated.forEach(result => {
        console.log(`${result.method.toUpperCase()}:`);
        console.log(`Average time across all queries: ${result.averageTime.toFixed(2)}ms`);
        console.log(`Average cache hit rate: ${(result.cacheHitRate * 100).toFixed(1)}%`);
        console.log(`Average number of results: ${result.averageResultCount.toFixed(1)}`);
        console.log('');
    });
    return aggregated;
}
if (require.main === module) {
    runSearchBenchmarks()
        .then(() => process.exit(0))
        .catch(error => {
        console.error('Benchmark error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=search.benchmark.js.map