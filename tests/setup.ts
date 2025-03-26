import { jest } from '@jest/globals';
import { PostgrestResponse, PostgrestSingleResponse, PostgrestError } from '@supabase/postgrest-js';
import { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { CreateEmbeddingResponse } from 'openai/resources';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Define interfaces for our mocks
interface EmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[];
    index: number;
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

// Create mock responses
const mockEmbeddingResponse: EmbeddingResponse = {
  object: 'list',
  data: [{
    object: 'embedding',
    embedding: new Array(1536).fill(0),
    index: 0
  }],
  model: 'text-embedding-ada-002',
  usage: {
    prompt_tokens: 8,
    total_tokens: 8
  }
};

// Mock OpenAI client
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      embeddings: {
        create: jest.fn().mockImplementation(() => Promise.resolve(mockEmbeddingResponse))
      }
    }))
  };
});

// Mock embedding generation
const mockGenerateEmbedding = jest.fn().mockImplementation(() => Promise.resolve(new Array(1536).fill(0)));

// Create mock class
class MockEmbeddingError extends Error {
  public retryable: boolean;
  constructor(message: string, cause: Error | null = null, retryable = true) {
    super(message);
    this.name = 'EmbeddingError';
    this.cause = cause;
    this.retryable = retryable;
  }
}

jest.mock('../src/utils/embeddings', () => ({
  __esModule: true,
  generateEmbedding: mockGenerateEmbedding,
  updateGuidelineEmbedding: jest.fn().mockImplementation(async () => undefined),
  batchUpdateEmbeddings: jest.fn().mockImplementation(async () => {
    return Array(10).fill({ success: true, error: null });
  }),
  EmbeddingError: MockEmbeddingError,
  setOpenAIClient: jest.fn(),
  setSupabaseClient: jest.fn()
}));

// Create a type-safe mock Supabase response
type MockPostgrestResponse<T> = {
  data: T[] | null;
  error: PostgrestError | null;
  count: number | null;
  status: number;
  statusText: string;
};

function createMockResponse<T>(data: T[] = [], error: PostgrestError | null = null): MockPostgrestResponse<T> {
  return {
    data,
    error,
    count: data.length,
    status: error ? 400 : 200,
    statusText: error ? 'Bad Request' : 'OK'
  };
}

const mockSupabaseResponse = createMockResponse([]);

// Mock query builder
class MockQueryBuilder<T> {
  private conditions: any[] = [];

  eq(column: string, value: any) {
    this.conditions.push({ column, op: 'eq', value });
    return this;
  }

  neq(column: string, value: any) {
    this.conditions.push({ column, op: 'neq', value });
    return this;
  }

  gt(column: string, value: any) {
    this.conditions.push({ column, op: 'gt', value });
    return this;
  }

  lt(column: string, value: any) {
    this.conditions.push({ column, op: 'lt', value });
    return this;
  }

  gte(column: string, value: any) {
    this.conditions.push({ column, op: 'gte', value });
    return this;
  }

  lte(column: string, value: any) {
    this.conditions.push({ column, op: 'lte', value });
    return this;
  }

  select(columns: string) {
    return this;
  }

  async execute(): Promise<PostgrestResponse<T>> {
    return {
      data: [],
      error: null,
      count: null,
      status: 200,
      statusText: 'OK'
    };
  }

  async insert(values: any): Promise<PostgrestResponse<T>> {
    return {
      data: values,
      error: null,
      count: 1,
      status: 201,
      statusText: 'Created'
    };
  }

  async update(values: any): Promise<PostgrestResponse<T>> {
    return {
      data: values,
      error: null,
      count: 1,
      status: 200,
      statusText: 'OK'
    };
  }

  async upsert(values: any): Promise<PostgrestResponse<T>> {
    return {
      data: values,
      error: null,
      count: 1,
      status: 200,
      statusText: 'OK'
    };
  }
}

// Define mock storage methods
const mockStorage = {
  upload: jest.fn().mockResolvedValue({ path: 'test.csv', error: null }),
  download: jest.fn().mockResolvedValue({ path: 'test.csv', error: null }),
  remove: jest.fn().mockResolvedValue({ path: 'test.csv', error: null }),
  list: jest.fn().mockResolvedValue({ path: 'test.csv', error: null }),
};

// Mock Supabase client
const mockSupabaseClient = {
  storage: {
    from: () => mockStorage
  },
  from: () => new MockQueryBuilder(),
  rpc: jest.fn().mockResolvedValue({ data: { success: true }, error: null })
};

// Set environment variables
process.env.OPENAI_API_KEY = 'test-api-key';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';

// Configure Jest
jest.setTimeout(30000); // 30 seconds

export type ChainableMethod<T = any> = {
  (...args: any[]): ChainableMock<T>;
};

export type ChainableMock<T = any> = {
  select: jest.Mock<any>;
  insert: jest.Mock<any>;
  update: jest.Mock<any>;
  delete: jest.Mock<any>;
  rpc: jest.Mock<any>;
  ilike: jest.Mock<any>;
  then: jest.Mock<any>;
} & {
  [key: string]: jest.Mock<any>;
};

export function createChainableMock<T = any>(): ChainableMock<T> {
  const mock = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    rpc: jest.fn(),
    ilike: jest.fn(),
    then: jest.fn()
  } as unknown as ChainableMock<T>;

  // Make each method return the mock itself for chaining
  Object.entries(mock).forEach(([key, method]) => {
    if (key !== 'then') {
      method.mockReturnThis();
    }
  });

  return mock;
}

// Clear all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Load test environment variables
config({ path: '.env.test' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing required environment variables for tests');
}

// Create test client
export const testClient = createClient(supabaseUrl, supabaseKey);

export async function setupTestDatabase() {
  // Clear existing test data
  await testClient.from('carriers').delete().neq('id', '0');
  
  // Insert test carrier
  await testClient.from('carriers').insert({
    id: 'test-carrier-1',
    name: 'Test Carrier',
    code: 'TEST1',
    active: true
  });
}

export async function teardownTestDatabase() {
  // Clean up test data
  await testClient.from('carriers').delete().neq('id', '0');
} 