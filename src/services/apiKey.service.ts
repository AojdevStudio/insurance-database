import { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError } from '../errors/database.error.js';
import { logger } from '../utils/logger.js';

export interface ApiKeyPermissions {
  allowedEndpoints: string[];
  rateLimits: {
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
  };
}

export interface ApiKey {
  id: string;
  name: string;
  expiresAt: Date;
  permissions: ApiKeyPermissions;
  status: 'active' | 'expired' | 'revoked';
  metadata: Record<string, unknown>;
  lastUsedAt?: Date;
  createdBy: string;
  version: number;
}

export interface ApiKeyCreateParams {
  name: string;
  expiresInDays: number;
  permissions: ApiKeyPermissions;
  metadata?: Record<string, unknown>;
}

export interface ApiKeyRotateParams {
  keyId: string;
  rotationReason: string;
  newExpiresInDays: number;
}

export interface KeyUsageStats {
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  lastUsed?: Date;
}

export class ApiKeyService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Creates a new API key
   * @param params Key creation parameters
   * @param userId User creating the key
   * @returns Created key details including the key value (only shown once)
   */
  async createKey(params: ApiKeyCreateParams, userId: string): Promise<{ 
    id: string;
    keyValue: string;
    expiresAt: Date;
  }> {
    try {
      const { data, error } = await this.supabase
        .rpc('create_api_key', {
          p_name: params.name,
          p_expires_in: `${params.expiresInDays} days`,
          p_permissions: params.permissions,
          p_created_by: userId
        });

      if (error) throw error;
      if (!data?.[0]) throw new DatabaseError('Failed to create API key');

      return {
        id: data[0].id,
        keyValue: data[0].key_value,
        expiresAt: new Date(data[0].expires_at)
      };
    } catch (error) {
      logger.error('Failed to create API key', { error, userId });
      throw new DatabaseError('Failed to create API key');
    }
  }

  /**
   * Validates an API key and returns its permissions if valid
   * @param keyValue The API key to validate
   * @returns Key validation result
   */
  async validateKey(keyValue: string): Promise<{
    isValid: boolean;
    keyId?: string;
    permissions?: ApiKeyPermissions;
  }> {
    try {
      const { data, error } = await this.supabase
        .rpc('validate_api_key', {
          p_key_value: keyValue
        });

      if (error) throw error;
      if (!data?.[0]) return { isValid: false };

      return {
        isValid: data[0].is_valid,
        keyId: data[0].key_id,
        permissions: data[0].permissions as ApiKeyPermissions
      };
    } catch (error) {
      logger.error('Failed to validate API key', { error });
      return { isValid: false };
    }
  }

  /**
   * Rotates an API key, creating a new one and expiring the old one
   * @param params Key rotation parameters
   * @param userId User performing the rotation
   * @returns New key details
   */
  async rotateKey(params: ApiKeyRotateParams, userId: string): Promise<{
    id: string;
    keyValue: string;
    expiresAt: Date;
  }> {
    try {
      const { data, error } = await this.supabase
        .rpc('rotate_api_key', {
          p_key_id: params.keyId,
          p_rotation_reason: params.rotationReason,
          p_new_expires_in: `${params.newExpiresInDays} days`,
          p_rotated_by: userId
        });

      if (error) throw error;
      if (!data?.[0]) throw new DatabaseError('Failed to rotate API key');

      return {
        id: data[0].id,
        keyValue: data[0].key_value,
        expiresAt: new Date(data[0].expires_at)
      };
    } catch (error) {
      logger.error('Failed to rotate API key', { error, userId });
      throw new DatabaseError('Failed to rotate API key');
    }
  }

  /**
   * Revokes an API key immediately
   * @param keyId ID of the key to revoke
   * @param userId User performing the revocation
   */
  async revokeKey(keyId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('api_keys')
        .update({
          status: 'revoked',
          expires_at: new Date(),
          metadata: {
            ...await this.getKeyMetadata(keyId),
            revoked_by: userId,
            revoked_at: new Date().toISOString()
          }
        })
        .eq('id', keyId)
        .eq('created_by', userId);

      if (error) throw error;
    } catch (error) {
      logger.error('Failed to revoke API key', { error, keyId, userId });
      throw new DatabaseError('Failed to revoke API key');
    }
  }

  /**
   * Lists all API keys for a user
   * @param userId User ID to list keys for
   * @returns List of API keys
   */
  async listKeys(userId: string): Promise<ApiKey[]> {
    try {
      const { data, error } = await this.supabase
        .from('api_keys')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data) return [];

      return data.map(key => ({
        id: key.id,
        name: key.name,
        expiresAt: new Date(key.expires_at),
        permissions: key.permissions,
        status: key.status,
        metadata: key.metadata,
        lastUsedAt: key.last_used_at ? new Date(key.last_used_at) : undefined,
        createdBy: key.created_by,
        version: key.version
      }));
    } catch (error) {
      logger.error('Failed to list API keys', { error, userId });
      throw new DatabaseError('Failed to list API keys');
    }
  }

  /**
   * Gets key usage statistics
   * @param keyId ID of the key to get stats for
   * @param userId User requesting the stats
   * @returns Key usage statistics
   */
  async getKeyUsageStats(keyId: string, userId: string): Promise<KeyUsageStats> {
    try {
      // First verify the user owns the key
      const { data: keyData, error: keyError } = await this.supabase
        .from('api_keys')
        .select('last_used_at')
        .eq('id', keyId)
        .eq('created_by', userId)
        .single();

      if (keyError) throw keyError;
      if (!keyData) throw new DatabaseError('API key not found');

      // Get usage statistics
      const { data: stats, error: statsError } = await this.supabase
        .from('key_usage_audit')
        .select('response_status, request_duration_ms')
        .eq('key_id', keyId);

      if (statsError) throw statsError;
      if (!stats) return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        lastUsed: keyData.last_used_at ? new Date(keyData.last_used_at) : undefined
      };

      const totalRequests = stats.length;
      const errorRequests = stats.filter(s => s.response_status >= 400).length;
      const totalDuration = stats.reduce((sum, s) => sum + s.request_duration_ms, 0);

      return {
        totalRequests,
        averageResponseTime: totalRequests > 0 ? totalDuration / totalRequests : 0,
        errorRate: totalRequests > 0 ? errorRequests / totalRequests : 0,
        lastUsed: keyData.last_used_at ? new Date(keyData.last_used_at) : undefined
      };
    } catch (error) {
      logger.error('Failed to get key usage stats', { error, keyId, userId });
      throw new DatabaseError('Failed to get key usage statistics');
    }
  }

  /**
   * Helper method to get current key metadata
   * @param keyId Key ID to get metadata for
   * @returns Current metadata object
   */
  private async getKeyMetadata(keyId: string): Promise<Record<string, unknown>> {
    const { data, error } = await this.supabase
      .from('api_keys')
      .select('metadata')
      .eq('id', keyId)
      .single();

    if (error) throw error;
    return data?.metadata || {};
  }
} 