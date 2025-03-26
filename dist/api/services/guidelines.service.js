import { supabase } from '../lib/supabase.js';
import { createClient as createRedisClient } from 'redis';
import { logger } from '../utils/logger.js';
import { OpenAIService } from './openai.service.js';
const redis = createRedisClient({
    url: process.env.REDIS_URL
});
redis.on('error', (err) => logger.error('Redis Client Error', err));
export class GuidelineService {
    static CACHE_TTL = 3600;
    static DEFAULT_MIN_SIMILARITY = 0.7;
    static DEFAULT_TEXT_WEIGHT = 0.3;
    static DEFAULT_VECTOR_WEIGHT = 0.7;
    static DEFAULT_RRF_K = 60.0;
    static async getCacheKey(params) {
        return `guidelines:${JSON.stringify(params)}`;
    }
    static async getFromCache(key) {
        try {
            const cached = await redis.get(key);
            return cached ? JSON.parse(cached) : null;
        }
        catch (error) {
            logger.error('Cache retrieval error:', error);
            return null;
        }
    }
    static async setCache(key, data) {
        try {
            await redis.setEx(key, this.CACHE_TTL, JSON.stringify(data));
        }
        catch (error) {
            logger.error('Cache setting error:', error);
        }
    }
    static formatGuideline(guideline) {
        return {
            ...guideline,
            created_at: new Date(guideline.created_at),
            text_similarity: guideline.text_similarity,
            vector_similarity: guideline.vector_similarity,
            combined_similarity: guideline.combined_similarity
        };
    }
    static async searchGuidelines(options = {}) {
        const { query = '', carrier_id, category, page = 1, limit = 10 } = options;
        const cacheKey = await this.getCacheKey({ query, carrier_id, category, page, limit });
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const offset = (page - 1) * limit;
        let dbQuery = supabase
            .from('guidelines')
            .select('*');
        if (query) {
            dbQuery = dbQuery.textSearch('content', query);
        }
        if (carrier_id) {
            dbQuery = dbQuery.eq('carrier_id', carrier_id);
        }
        if (category) {
            dbQuery = dbQuery.eq('category', category);
        }
        const { data: countResult, error: countError } = await dbQuery.select('id');
        if (countError)
            throw countError;
        const total = countResult.length;
        const { data: guidelines, error } = await dbQuery
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });
        if (error)
            throw error;
        const result = {
            guidelines: (guidelines || []).map((g) => this.formatGuideline(g)),
            total,
            page,
            limit,
            total_pages: Math.ceil(total / limit)
        };
        await this.setCache(cacheKey, result);
        return result;
    }
    static async semanticSearch(options) {
        const { query, carrier_id, category, limit = 10, min_similarity = this.DEFAULT_MIN_SIMILARITY } = options;
        if (!query) {
            throw new Error('Query is required for semantic search');
        }
        const cacheKey = await this.getCacheKey({
            query,
            carrier_id,
            category,
            limit,
            min_similarity,
            type: 'semantic'
        });
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const embedding = await OpenAIService.createEmbedding(query);
        let dbQuery = supabase.rpc('match_guidelines', {
            query_embedding: embedding,
            similarity_threshold: min_similarity,
            match_count: limit
        });
        if (carrier_id) {
            dbQuery = dbQuery.eq('carrier_id', carrier_id);
        }
        if (category) {
            dbQuery = dbQuery.eq('category', category);
        }
        const { data: guidelines, error } = await dbQuery;
        if (error)
            throw error;
        const result = {
            guidelines: (guidelines || []).map((g) => this.formatGuideline(g)),
            total: guidelines?.length || 0,
            page: 1,
            limit,
            total_pages: 1
        };
        await this.setCache(cacheKey, result);
        return result;
    }
    static async textSearch(options) {
        const { query, carrier_id, category, limit = 10, min_similarity = this.DEFAULT_MIN_SIMILARITY } = options;
        if (!query) {
            throw new Error('Query is required for text search');
        }
        const cacheKey = await this.getCacheKey({
            ...options,
            type: 'text'
        });
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        let dbQuery = supabase.rpc('text_search_guidelines', {
            query_text: query,
            similarity_threshold: min_similarity,
            match_count: limit
        });
        if (carrier_id) {
            dbQuery = dbQuery.eq('carrier_id', carrier_id);
        }
        if (category) {
            dbQuery = dbQuery.eq('category', category);
        }
        const { data: guidelines, error } = await dbQuery;
        if (error)
            throw error;
        const result = {
            guidelines: (guidelines || []).map((g) => ({
                ...this.formatGuideline(g),
                text_similarity: g.text_similarity
            })),
            total: guidelines?.length || 0,
            page: 1,
            limit,
            total_pages: 1
        };
        await this.setCache(cacheKey, result);
        return result;
    }
    static async hybridSearch(options) {
        const { query, carrier_id, category, limit = 10, min_similarity = this.DEFAULT_MIN_SIMILARITY, text_weight = this.DEFAULT_TEXT_WEIGHT, vector_weight = this.DEFAULT_VECTOR_WEIGHT } = options;
        if (!query) {
            throw new Error('Query is required for hybrid search');
        }
        const cacheKey = await this.getCacheKey({
            ...options,
            type: 'hybrid'
        });
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const embedding = await OpenAIService.createEmbedding(query);
        let dbQuery = supabase.rpc('hybrid_search_guidelines', {
            query_text: query,
            query_embedding: embedding,
            text_weight,
            vector_weight,
            similarity_threshold: min_similarity,
            match_count: limit
        });
        if (carrier_id) {
            dbQuery = dbQuery.eq('carrier_id', carrier_id);
        }
        if (category) {
            dbQuery = dbQuery.eq('category', category);
        }
        const { data: guidelines, error } = await dbQuery;
        if (error)
            throw error;
        const result = {
            guidelines: (guidelines || []).map((g) => ({
                ...this.formatGuideline(g),
                text_similarity: g.text_similarity,
                vector_similarity: g.vector_similarity,
                combined_similarity: g.combined_similarity
            })),
            total: guidelines?.length || 0,
            page: 1,
            limit,
            total_pages: 1
        };
        await this.setCache(cacheKey, result);
        return result;
    }
    static async rrf_hybridSearch(options) {
        const { query, carrier_id, category, limit = 10, min_similarity = this.DEFAULT_MIN_SIMILARITY, rrf_k = this.DEFAULT_RRF_K } = options;
        if (!query) {
            throw new Error('Query is required for RRF hybrid search');
        }
        const cacheKey = await this.getCacheKey({
            ...options,
            type: 'rrf_hybrid'
        });
        const cached = await this.getFromCache(cacheKey);
        if (cached)
            return cached;
        const embedding = await OpenAIService.createEmbedding(query);
        let dbQuery = supabase.rpc('rrf_hybrid_search_guidelines', {
            query_text: query,
            query_embedding: embedding,
            k: rrf_k,
            similarity_threshold: min_similarity,
            match_count: limit
        });
        if (carrier_id) {
            dbQuery = dbQuery.eq('carrier_id', carrier_id);
        }
        if (category) {
            dbQuery = dbQuery.eq('category', category);
        }
        const { data: guidelines, error } = await dbQuery;
        if (error)
            throw error;
        const result = {
            guidelines: (guidelines || []).map((g) => ({
                ...this.formatGuideline(g),
                text_similarity: g.text_similarity,
                vector_similarity: g.vector_similarity,
                rrf_score: g.rrf_score,
                explanation: g.explanation
            })),
            total: guidelines?.length || 0,
            page: 1,
            limit,
            total_pages: 1
        };
        await this.setCache(cacheKey, result);
        return result;
    }
    static async search(options) {
        const { search_type = 'semantic' } = options;
        switch (search_type) {
            case 'rrf_hybrid':
                return this.rrf_hybridSearch(options);
            case 'hybrid':
                return this.hybridSearch(options);
            case 'semantic':
                return this.semanticSearch(options);
            case 'text':
                return this.textSearch(options);
            default:
                throw new Error(`Invalid search type: ${search_type}`);
        }
    }
}
//# sourceMappingURL=guidelines.service.js.map