import { config } from 'dotenv';
import { OpenAIConfigSchema } from './types.js';
config();
function loadConfig() {
    const rawConfig = {
        apiKey: process.env.OPENAI_API_KEY,
        orgId: process.env.OPENAI_ORG_ID,
        maxRetries: Number(process.env.OPENAI_MAX_RETRIES),
        rateLimitRPM: Number(process.env.OPENAI_RATE_LIMIT_RPM),
        timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS),
    };
    try {
        return OpenAIConfigSchema.parse(rawConfig);
    }
    catch (error) {
        throw new Error(`Invalid OpenAI configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
let configInstance = null;
export function getConfig() {
    if (!configInstance) {
        configInstance = loadConfig();
    }
    return configInstance;
}
export function validateConfig(config) {
    try {
        return OpenAIConfigSchema.parse(config);
    }
    catch (error) {
        throw new Error(`Invalid OpenAI configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
export function resetConfig() {
    configInstance = null;
}
//# sourceMappingURL=config.js.map