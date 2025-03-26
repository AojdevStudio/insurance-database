import { CreateEmbeddingResponse } from 'openai/resources/embeddings';
import { PostgrestResponse, PostgrestError } from '@supabase/postgrest-js';
import { SupabaseClient } from '@supabase/supabase-js';
import { StorageError } from '@supabase/storage-js';
import OpenAI from 'openai';

export interface MockStorageResponse<T> {
  data: T | null;
  error: StorageError | null;
}

export interface MockQueryBuilder<T> {
  eq: (...args: any[]) => MockQueryBuilder<T>;
  neq: (...args: any[]) => MockQueryBuilder<T>;
  gt: (...args: any[]) => MockQueryBuilder<T>;
  lt: (...args: any[]) => MockQueryBuilder<T>;
  gte: (...args: any[]) => MockQueryBuilder<T>;
  lte: (...args: any[]) => MockQueryBuilder<T>;
  like: (...args: any[]) => MockQueryBuilder<T>;
  ilike: (...args: any[]) => MockQueryBuilder<T>;
  is: (...args: any[]) => MockQueryBuilder<T>;
  in: (...args: any[]) => MockQueryBuilder<T>;
  contains: (...args: any[]) => MockQueryBuilder<T>;
  containedBy: (...args: any[]) => MockQueryBuilder<T>;
  range: (...args: any[]) => MockQueryBuilder<T>;
  textSearch: (...args: any[]) => MockQueryBuilder<T>;
  match: (...args: any[]) => MockQueryBuilder<T>;
  not: (...args: any[]) => MockQueryBuilder<T>;
  or: (...args: any[]) => MockQueryBuilder<T>;
  filter: (...args: any[]) => MockQueryBuilder<T>;
  order: (...args: any[]) => MockQueryBuilder<T>;
  limit: (...args: any[]) => MockQueryBuilder<T>;
  offset: (...args: any[]) => MockQueryBuilder<T>;
  select: (...args: any[]) => MockQueryBuilder<T>;
  single: (...args: any[]) => MockQueryBuilder<T>;
  execute: () => Promise<PostgrestResponse<T>>;
  then: (onfulfilled?: ((value: PostgrestResponse<T>) => any) | null) => Promise<any>;
}

export type MockOpenAIClient = Pick<OpenAI, 'apiKey' | 'organization'> & {
  embeddings: {
    create: jest.Mock<Promise<CreateEmbeddingResponse>, any[]>;
  };
};

export interface MockSupabaseClient {
  from: <T>(table: string) => MockQueryBuilder<T>;
  storage: {
    from: (bucket: string) => {
      upload: jest.Mock<Promise<MockStorageResponse<{ path: string }>>, any[]>;
      download: jest.Mock<Promise<MockStorageResponse<Uint8Array>>, any[]>;
      remove: jest.Mock<Promise<MockStorageResponse<{ path: string }>>, any[]>;
      list: jest.Mock<Promise<MockStorageResponse<Array<{ name: string }>>>, any[]>;
    };
  };
  rpc: jest.Mock<Promise<PostgrestResponse<any>>, any[]>;
} 