/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest', 
      {
        useESM: true,
        // Add tsconfig options to override rootDir
        tsconfig: {
          rootDir: './'
        }
      }
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Set up environment variables for testing
  setupFiles: ['<rootDir>/tests/setup-env.js'],
  // Global teardown after all tests are done
  globalTeardown: '<rootDir>/tests/teardown.js',
  // Collect coverage information
  collectCoverage: false,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/types/**',
    '!**/node_modules/**',
  ],
  // For mocking @prisma/client properly
  modulePathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
  // Increase timeout for tests that deal with database operations
  testTimeout: 30000,
}; 