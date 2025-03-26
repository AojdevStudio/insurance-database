import { DatabaseError } from '../errors/database.error.js';
import { logger } from '../utils/logger.js';
export class ApiKeyService {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async createKey(params, userId) {
        try {
            const { data, error } = await this.supabase
                .rpc('create_api_key', {
                p_name: params.name,
                p_expires_in: `${params.expiresInDays} days`,
                p_permissions: params.permissions,
                p_created_by: userId
            });
            if (error)
                throw error;
            if (!data?.[0])
                throw new DatabaseError('Failed to create API key');
            return {
                id: data[0].id,
                keyValue: data[0].key_value,
                expiresAt: new Date(data[0].expires_at)
            };
        }
        catch (error) {
            logger.error('Failed to create API key', { error, userId });
            throw new DatabaseError('Failed to create API key');
        }
    }
    async validateKey(keyValue) {
        try {
            const { data, error } = await this.supabase
                .rpc('validate_api_key', {
                p_key_value: keyValue
            });
            if (error)
                throw error;
            if (!data?.[0])
                return { isValid: false };
            return {
                isValid: data[0].is_valid,
                keyId: data[0].key_id,
                permissions: data[0].permissions
            };
        }
        catch (error) {
            logger.error('Failed to validate API key', { error });
            return { isValid: false };
        }
    }
    async rotateKey(params, userId) {
        try {
            const { data, error } = await this.supabase
                .rpc('rotate_api_key', {
                p_key_id: params.keyId,
                p_rotation_reason: params.rotationReason,
                p_new_expires_in: `${params.newExpiresInDays} days`,
                p_rotated_by: userId
            });
            if (error)
                throw error;
            if (!data?.[0])
                throw new DatabaseError('Failed to rotate API key');
            return {
                id: data[0].id,
                keyValue: data[0].key_value,
                expiresAt: new Date(data[0].expires_at)
            };
        }
        catch (error) {
            logger.error('Failed to rotate API key', { error, userId });
            throw new DatabaseError('Failed to rotate API key');
        }
    }
    async revokeKey(keyId, userId) {
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
            if (error)
                throw error;
        }
        catch (error) {
            logger.error('Failed to revoke API key', { error, keyId, userId });
            throw new DatabaseError('Failed to revoke API key');
        }
    }
    async listKeys(userId) {
        try {
            const { data, error } = await this.supabase
                .from('api_keys')
                .select('*')
                .eq('created_by', userId)
                .order('created_at', { ascending: false });
            if (error)
                throw error;
            if (!data)
                return [];
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
        }
        catch (error) {
            logger.error('Failed to list API keys', { error, userId });
            throw new DatabaseError('Failed to list API keys');
        }
    }
    async getKeyUsageStats(keyId, userId) {
        try {
            const { data: keyData, error: keyError } = await this.supabase
                .from('api_keys')
                .select('last_used_at')
                .eq('id', keyId)
                .eq('created_by', userId)
                .single();
            if (keyError)
                throw keyError;
            if (!keyData)
                throw new DatabaseError('API key not found');
            const { data: stats, error: statsError } = await this.supabase
                .from('key_usage_audit')
                .select('response_status, request_duration_ms')
                .eq('key_id', keyId);
            if (statsError)
                throw statsError;
            if (!stats)
                return {
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
        }
        catch (error) {
            logger.error('Failed to get key usage stats', { error, keyId, userId });
            throw new DatabaseError('Failed to get key usage statistics');
        }
    }
    async getKeyMetadata(keyId) {
        const { data, error } = await this.supabase
            .from('api_keys')
            .select('metadata')
            .eq('id', keyId)
            .single();
        if (error)
            throw error;
        return data?.metadata || {};
    }
}
//# sourceMappingURL=apiKey.service.js.map