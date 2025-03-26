import { config } from 'dotenv';
import { OpenAIConfig, OpenAIConfigSchema } from './types.js';

// Load environment variables
config();

/**
 * Loads and validates OpenAI configuration from environment variables
 * @throws {Error} If configuration is invalid
 */
function loadConfig(): OpenAIConfig {
  const rawConfig = {
    apiKey: process.env.OPENAI_API_KEY,
    orgId: process.env.OPENAI_ORG_ID,
    maxRetries: Number(process.env.OPENAI_MAX_RETRIES),
    rateLimitRPM: Number(process.env.OPENAI_RATE_LIMIT_RPM),
    timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS),
  };

  try {
    return OpenAIConfigSchema.parse(rawConfig);
  } catch (error) {
    throw new Error(`Invalid OpenAI configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Singleton instance
let configInstance: OpenAIConfig | null = null;

/**
 * Gets the OpenAI configuration, creating it if it doesn't exist
 * @returns {OpenAIConfig} The validated configuration
 * @throws {Error} If configuration is invalid
 */
export function getConfig(): OpenAIConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * Validates a configuration object against the schema
 * @param config Configuration object to validate
 * @returns {OpenAIConfig} The validated configuration
 * @throws {Error} If configuration is invalid
 */
export function validateConfig(config: unknown): OpenAIConfig {
  try {
    return OpenAIConfigSchema.parse(config);
  } catch (error) {
    throw new Error(`Invalid OpenAI configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Resets the configuration instance (useful for testing)
 */
export function resetConfig(): void {
  configInstance = null;
} 