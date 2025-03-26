import dotenv from 'dotenv';
dotenv.config();
export const config = {
    env: process.env.NODE_ENV || 'development',
    server: {
        port: parseInt(process.env.PORT || '3000', 10),
        host: process.env.HOST || 'localhost',
    },
    supabase: {
        url: process.env.SUPABASE_URL || 'http://localhost:54321',
        anonKey: process.env.SUPABASE_ANON_KEY || '',
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'text-embedding-ada-002',
        maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3', 10),
        timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000', 10),
    },
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
        max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    },
    cache: {
        ttl: parseInt(process.env.CACHE_TTL || '3600', 10),
        checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD || '600', 10),
    },
    test: {
        database: {
            name: process.env.TEST_DB_NAME || 'insurance_test',
            host: process.env.TEST_DB_HOST || 'localhost',
            port: parseInt(process.env.TEST_DB_PORT || '54322', 10),
            user: process.env.TEST_DB_USER || 'postgres',
            password: process.env.TEST_DB_PASSWORD || 'postgres',
        },
    },
};
//# sourceMappingURL=index.js.map