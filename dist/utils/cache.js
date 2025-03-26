import { Logger } from './logging.js';
import { trackRequestMetrics } from './monitoring.js';
const logger = new Logger('cache-service');
class LRUCache {
    cache;
    metrics;
    config;
    constructor(config) {
        this.cache = new Map();
        this.config = config;
        this.metrics = {
            hits: 0,
            misses: 0,
            evictions: 0,
            size: 0
        };
        setInterval(() => this.cleanup(), Math.min(config.ttlMs / 2, 60000));
    }
    async get(key) {
        return trackRequestMetrics(async () => {
            const entry = this.cache.get(key);
            if (!entry) {
                this.metrics.misses++;
                return undefined;
            }
            const now = Date.now();
            if (now - entry.timestamp > this.config.ttlMs) {
                this.delete(key);
                this.metrics.misses++;
                return undefined;
            }
            entry.timestamp = now;
            entry.lastAccessed = now;
            this.metrics.hits++;
            return entry.value;
        }, `cache-get-${this.config.name}`);
    }
    async set(key, value) {
        return trackRequestMetrics(async () => {
            const now = Date.now();
            if (!this.cache.has(key) && this.cache.size >= this.config.maxSize) {
                this.evictOldest();
            }
            this.cache.set(key, {
                value,
                timestamp: now,
                lastAccessed: now
            });
            this.metrics.size = this.cache.size;
            logger.debug('Cache entry added', {
                cache: this.config.name,
                key: String(key),
                size: this.cache.size
            });
        }, `cache-set-${this.config.name}`);
    }
    delete(key) {
        const existed = this.cache.delete(key);
        if (existed) {
            this.metrics.size = this.cache.size;
            logger.debug('Cache entry deleted', {
                cache: this.config.name,
                key: String(key),
                size: this.cache.size
            });
        }
    }
    clear() {
        const previousSize = this.cache.size;
        this.cache.clear();
        this.metrics.size = 0;
        if (previousSize > 0) {
            logger.info('Cache cleared', {
                cache: this.config.name,
                previousSize
            });
        }
    }
    getMetrics() {
        return { ...this.metrics };
    }
    cleanup() {
        const now = Date.now();
        let expiredCount = 0;
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > this.config.ttlMs) {
                this.delete(key);
                expiredCount++;
            }
        }
        if (expiredCount > 0) {
            this.metrics.evictions += expiredCount;
            logger.debug('Cache entries expired', {
                cache: this.config.name,
                count: expiredCount,
                remainingSize: this.cache.size
            });
        }
    }
    evictOldest() {
        let oldestKey;
        let oldestAccessed = Infinity;
        for (const [key, entry] of this.cache.entries()) {
            if (entry.lastAccessed < oldestAccessed) {
                oldestAccessed = entry.lastAccessed;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.delete(oldestKey);
            this.metrics.evictions++;
            logger.debug('Cache entry evicted', {
                cache: this.config.name,
                key: String(oldestKey)
            });
        }
    }
}
const CACHE_CONFIG = {
    EMBEDDINGS: {
        maxSize: 1000,
        ttlMs: 24 * 60 * 60 * 1000,
        name: 'embeddings'
    },
    SEARCH_RESULTS: {
        maxSize: 100,
        ttlMs: 60 * 60 * 1000,
        name: 'search-results'
    },
    METRICS: {
        maxSize: 50,
        ttlMs: 5 * 60 * 1000,
        name: 'metrics'
    }
};
export const embeddingsCache = new LRUCache(CACHE_CONFIG.EMBEDDINGS);
export const searchResultsCache = new LRUCache(CACHE_CONFIG.SEARCH_RESULTS);
export const metricsCache = new LRUCache(CACHE_CONFIG.METRICS);
export { LRUCache, CACHE_CONFIG };
//# sourceMappingURL=cache.js.map