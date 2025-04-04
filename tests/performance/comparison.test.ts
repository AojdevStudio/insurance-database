/**
 * Performance comparison tests between Supabase and Prisma implementations
 */
import request from 'supertest';
import app from '../../src/api/app.js';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';

// Sample test API key for testing
const TEST_API_KEY = 'test-api-key';

// Performance test configuration
const NUM_RUNS = 10; // Number of runs for each test
const WARMUP_RUNS = 3; // Number of warmup runs before timing
const ENDPOINTS = [
  {
    name: 'Carriers List',
    supabase: '/api/carriers',
    prisma: '/api/prisma/carriers'
  },
  {
    name: 'Carriers Search',
    supabase: '/api/carriers/search?query=Blue',
    prisma: '/api/prisma/carriers/search?query=Blue'
  },
  {
    name: 'Procedures List',
    supabase: '/api/procedures',
    prisma: '/api/prisma/procedures'
  },
  {
    name: 'Guidelines Search',
    supabase: '/api/guidelines/search?query=documentation',
    prisma: '/api/prisma/guidelines/search?query=documentation'
  }
];

// Handle test results
interface TestResult {
  endpoint: string;
  implementation: 'Supabase' | 'Prisma';
  times: number[];
  avgTime: number;
  minTime: number;
  maxTime: number;
}

// Only run performance tests in development, not in CI
const isCI = process.env.CI === 'true';

describe('Performance Comparison Tests', () => {
  (isCI ? describe.skip : describe)('Performance Benchmarks', () => {
    const results: TestResult[] = [];
    
    // Execute all tests before analyzing results
    beforeAll(async () => {
      console.log('⏱️ Running performance comparison tests...');
      console.log(`🔄 ${WARMUP_RUNS} warmup runs + ${NUM_RUNS} timed runs per endpoint`);
      
      // Perform warmup runs to eliminate JIT/cache effects
      console.log('🔥 Performing warmup runs...');
      for (let i = 0; i < WARMUP_RUNS; i++) {
        for (const endpoint of ENDPOINTS) {
          await request(app).get(endpoint.supabase).set('X-API-Key', TEST_API_KEY);
          await request(app).get(endpoint.prisma).set('X-API-Key', TEST_API_KEY);
        }
      }
      
      // Run tests for each endpoint
      for (const endpoint of ENDPOINTS) {
        console.log(`🧪 Testing: ${endpoint.name}`);
        
        // Test Supabase implementation
        const supabaseTimes: number[] = [];
        for (let i = 0; i < NUM_RUNS; i++) {
          const startTime = performance.now();
          await request(app).get(endpoint.supabase).set('X-API-Key', TEST_API_KEY);
          const endTime = performance.now();
          supabaseTimes.push(endTime - startTime);
        }
        
        // Test Prisma implementation
        const prismaTimes: number[] = [];
        for (let i = 0; i < NUM_RUNS; i++) {
          const startTime = performance.now();
          await request(app).get(endpoint.prisma).set('X-API-Key', TEST_API_KEY);
          const endTime = performance.now();
          prismaTimes.push(endTime - startTime);
        }
        
        // Calculate statistics
        const supabaseAvg = supabaseTimes.reduce((a, b) => a + b, 0) / NUM_RUNS;
        const prismaAvg = prismaTimes.reduce((a, b) => a + b, 0) / NUM_RUNS;
        
        // Store results
        results.push({
          endpoint: endpoint.name,
          implementation: 'Supabase',
          times: supabaseTimes,
          avgTime: supabaseAvg,
          minTime: Math.min(...supabaseTimes),
          maxTime: Math.max(...supabaseTimes)
        });
        
        results.push({
          endpoint: endpoint.name,
          implementation: 'Prisma',
          times: prismaTimes,
          avgTime: prismaAvg,
          minTime: Math.min(...prismaTimes),
          maxTime: Math.max(...prismaTimes)
        });
        
        console.log(`  Supabase: ${supabaseAvg.toFixed(2)}ms, Prisma: ${prismaAvg.toFixed(2)}ms`);
      }
      
      // Write results to file
      const resultsDir = path.join('tests', 'performance', 'results');
      if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const resultsFile = path.join(resultsDir, `comparison-${timestamp}.json`);
      
      fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
      console.log(`📝 Results written to ${resultsFile}`);
    });
    
    // Tests for each endpoint
    for (const endpoint of ENDPOINTS) {
      it(`should compare ${endpoint.name} performance`, () => {
        // Find results for this endpoint
        const supabaseResult = results.find(r => r.endpoint === endpoint.name && r.implementation === 'Supabase');
        const prismaResult = results.find(r => r.endpoint === endpoint.name && r.implementation === 'Prisma');
        
        // Skip if results not found
        if (!supabaseResult || !prismaResult) {
          console.warn(`Missing results for ${endpoint.name}`);
          return;
        }
        
        console.log(`\n📊 ${endpoint.name} Performance:`);
        console.log(`  Supabase: avg=${supabaseResult.avgTime.toFixed(2)}ms, min=${supabaseResult.minTime.toFixed(2)}ms, max=${supabaseResult.maxTime.toFixed(2)}ms`);
        console.log(`  Prisma:   avg=${prismaResult.avgTime.toFixed(2)}ms, min=${prismaResult.minTime.toFixed(2)}ms, max=${prismaResult.maxTime.toFixed(2)}ms`);
        
        // Calculate difference
        const diff = (prismaResult.avgTime - supabaseResult.avgTime) / supabaseResult.avgTime * 100;
        console.log(`  Difference: ${diff.toFixed(2)}% (${diff > 0 ? 'Prisma slower' : 'Prisma faster'})`);
        
        // This is a soft assertion - we don't fail the test on performance regression
        // Just log the result for analysis and decision-making
        if (diff > 100) { // Allow up to 2x slower
          console.warn(`⚠️ Prisma implementation is significantly slower (${diff.toFixed(2)}% difference)`);
        }
        
        // For very similar or better performance, log a success message
        if (diff < 20) {
          console.log(`✅ Prisma implementation has comparable or better performance!`);
        }
        
        // Verify response time is reasonable
        expect(prismaResult.avgTime).toBeLessThan(5000); // Max 5 seconds avg response time
      });
    }
    
    // Summary test
    it('should provide overall performance summary', () => {
      // Group results by implementation
      const supabaseResults = results.filter(r => r.implementation === 'Supabase');
      const prismaResults = results.filter(r => r.implementation === 'Prisma');
      
      // Calculate overall averages
      const supabaseOverallAvg = supabaseResults.reduce((sum, r) => sum + r.avgTime, 0) / supabaseResults.length;
      const prismaOverallAvg = prismaResults.reduce((sum, r) => sum + r.avgTime, 0) / prismaResults.length;
      
      // Calculate overall difference
      const overallDiff = (prismaOverallAvg - supabaseOverallAvg) / supabaseOverallAvg * 100;
      
      console.log('\n📈 Overall Performance Summary:');
      console.log(`  Supabase: ${supabaseOverallAvg.toFixed(2)}ms average`);
      console.log(`  Prisma:   ${prismaOverallAvg.toFixed(2)}ms average`);
      console.log(`  Overall Difference: ${overallDiff.toFixed(2)}%`);
      
      if (overallDiff > 50) {
        console.warn('⚠️ Prisma implementation is significantly slower overall');
        console.warn('   Consider optimization before full migration');
      } else {
        console.log('✅ Performance is acceptable for migration');
      }
      
      // Find best and worst performing endpoints
      const differences = ENDPOINTS.map(endpoint => {
        const supabaseResult = results.find(r => r.endpoint === endpoint.name && r.implementation === 'Supabase');
        const prismaResult = results.find(r => r.endpoint === endpoint.name && r.implementation === 'Prisma');
        
        if (supabaseResult && prismaResult) {
          const diff = (prismaResult.avgTime - supabaseResult.avgTime) / supabaseResult.avgTime * 100;
          return { endpoint: endpoint.name, diff };
        }
        return null;
      }).filter(Boolean);
      
      // Sort by difference (worst to best)
      differences.sort((a, b) => b.diff - a.diff);
      
      console.log('\n🔍 Endpoint Performance (worst to best):');
      differences.forEach(d => {
        console.log(`  ${d.endpoint}: ${d.diff.toFixed(2)}% difference`);
      });
      
      // Log optimization recommendations
      if (differences.length > 0 && differences[0].diff > 50) {
        console.log(`\n⚙️ Optimization Recommendation: Focus on "${differences[0].endpoint}" first`);
      }
      
      // This test doesn't assert anything, it's for information only
    });
  });
});
