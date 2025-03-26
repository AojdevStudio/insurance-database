import { runSearchBenchmarks } from '../src/api/services/__tests__/search.benchmark.js';
import { config } from 'dotenv';

// Load environment variables
config();

async function main() {
  try {
    console.log('Running search benchmarks...\n');
    const results = await runSearchBenchmarks();
    
    // Save results to a file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fs = await import('fs/promises');
    await fs.writeFile(
      `benchmark-results-${timestamp}.json`,
      JSON.stringify(results, null, 2)
    );
    
    console.log('\nBenchmark results have been saved to:', `benchmark-results-${timestamp}.json`);
  } catch (error) {
    console.error('Error running benchmarks:', error);
    process.exit(1);
  }
}

main(); 