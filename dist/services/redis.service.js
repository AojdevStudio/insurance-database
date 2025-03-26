import { createClient } from 'redis';
import { Logger } from '../utils/logging.js';
import { trackRequestMetrics } from '../utils/monitoring.js';
const logger = new Logger('redis-service');
export class RedisService {
    client;
    config;
    connected = false;
    constructor(config) {
        this.config = {
            maxRetries: 3,
            retryBackoff: 1000,
            defaultTTL: 3600,
            ...config
        };
        this.client = createClient({
            url: this.config.url,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > this.config.maxRetries) {
                        logger.error('Max Redis reconnection attempts reached');
                        return new Error('Max reconnection attempts reached');
                    }
                    return Math.min(retries * this.config.retryBackoff, 10000);
                }
            }
        });
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.client.on('error', (err) => {
            logger.error('Redis Client Error', err);
            this.connected = false;
        });
        this.client.on('connect', () => {
            logger.info('Redis Client Connected');
            this.connected = true;
        });
        this.client.on('reconnecting', () => {
            logger.info('Redis Client Reconnecting');
        });
    }
    async connect() {
        if (!this.connected) {
            await this.client.connect();
        }
    }
    async disconnect() {
        if (this.connected) {
            await this.client.disconnect();
            this.connected = false;
        }
    }
    async get(key) {
        return trackRequestMetrics(async () => {
            try {
                const value = await this.client.get(key);
                return value ? JSON.parse(value) : null;
            }
            catch (error) {
                logger.error('Redis get error:', error instanceof Error ? error : new Error(String(error)));
                return null;
            }
        }, 'redis-get');
    }
    async set(key, value, ttl) {
        return trackRequestMetrics(async () => {
            try {
                const result = await this.client.setEx(key, ttl || this.config.defaultTTL, JSON.stringify(value));
                return result === 'OK';
            }
            catch (error) {
                logger.error('Redis set error:', error instanceof Error ? error : new Error(String(error)));
                return false;
            }
        }, 'redis-set');
    }
    async delete(key) {
        return trackRequestMetrics(async () => {
            try {
                const result = await this.client.del(key);
                return result > 0;
            }
            catch (error) {
                logger.error('Redis delete error:', error instanceof Error ? error : new Error(String(error)));
                return false;
            }
        }, 'redis-delete');
    }
    async hSet(hash, field, value) {
        return trackRequestMetrics(async () => {
            try {
                await this.client.hSet(hash, field, JSON.stringify(value));
                return true;
            }
            catch (error) {
                logger.error('Redis hSet error:', error instanceof Error ? error : new Error(String(error)));
                return false;
            }
        }, 'redis-hset');
    }
    async hGet(hash, field) {
        return trackRequestMetrics(async () => {
            try {
                const value = await this.client.hGet(hash, field);
                return value ? JSON.parse(value) : null;
            }
            catch (error) {
                logger.error('Redis hGet error:', error instanceof Error ? error : new Error(String(error)));
                return null;
            }
        }, 'redis-hget');
    }
    async hGetAll(hash) {
        return trackRequestMetrics(async () => {
            try {
                const result = await this.client.hGetAll(hash);
                if (!Object.keys(result).length)
                    return null;
                return Object.entries(result).reduce((acc, [key, value]) => {
                    acc[key] = JSON.parse(value);
                    return acc;
                }, {});
            }
            catch (error) {
                logger.error('Redis hGetAll error:', error instanceof Error ? error : new Error(String(error)));
                return null;
            }
        }, 'redis-hgetall');
    }
    async exists(key) {
        return trackRequestMetrics(async () => {
            try {
                const result = await this.client.exists(key);
                return result === 1;
            }
            catch (error) {
                logger.error('Redis exists error:', error instanceof Error ? error : new Error(String(error)));
                return false;
            }
        }, 'redis-exists');
    }
    async clear() {
        return trackRequestMetrics(async () => {
            try {
                await this.client.flushDb();
            }
            catch (error) {
                logger.error('Redis clear error:', error instanceof Error ? error : new Error(String(error)));
            }
        }, 'redis-clear');
    }
}
//# sourceMappingURL=redis.service.js.map