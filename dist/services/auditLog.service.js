import { logger } from '../utils/logger.js';
export class AuditLogService {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async logRequest(entry) {
        try {
            const { error } = await this.supabase
                .from('key_usage_audit')
                .insert({
                key_id: entry.keyId,
                endpoint: entry.endpoint,
                request_method: entry.requestMethod,
                response_status: entry.responseStatus,
                client_ip: entry.clientIp,
                user_agent: entry.userAgent,
                request_id: entry.requestId,
                request_duration_ms: entry.requestDurationMs
            });
            if (error)
                throw error;
        }
        catch (error) {
            logger.error('Failed to record audit log entry', { error, entry });
        }
    }
    async getKeyAuditLog(keyId, userId, limit = 100, offset = 0) {
        try {
            const { data: keyData, error: keyError } = await this.supabase
                .from('api_keys')
                .select('id')
                .eq('id', keyId)
                .eq('created_by', userId)
                .single();
            if (keyError)
                throw keyError;
            if (!keyData)
                throw new Error('API key not found');
            const { data, error, count } = await this.supabase
                .from('key_usage_audit')
                .select('*', { count: 'exact' })
                .eq('key_id', keyId)
                .order('timestamp', { ascending: false })
                .range(offset, offset + limit - 1);
            if (error)
                throw error;
            return {
                entries: (data || []).map(entry => ({
                    keyId: entry.key_id,
                    endpoint: entry.endpoint,
                    requestMethod: entry.request_method,
                    responseStatus: entry.response_status,
                    clientIp: entry.client_ip,
                    userAgent: entry.user_agent,
                    requestId: entry.request_id,
                    requestDurationMs: entry.request_duration_ms
                })),
                total: count || 0
            };
        }
        catch (error) {
            logger.error('Failed to get audit log entries', { error, keyId, userId });
            throw error;
        }
    }
    async getKeyErrors(keyId, userId, limit = 100, offset = 0) {
        try {
            const { data: keyData, error: keyError } = await this.supabase
                .from('api_keys')
                .select('id')
                .eq('id', keyId)
                .eq('created_by', userId)
                .single();
            if (keyError)
                throw keyError;
            if (!keyData)
                throw new Error('API key not found');
            const { data, error, count } = await this.supabase
                .from('key_usage_audit')
                .select('*', { count: 'exact' })
                .eq('key_id', keyId)
                .gte('response_status', 400)
                .order('timestamp', { ascending: false })
                .range(offset, offset + limit - 1);
            if (error)
                throw error;
            return {
                entries: (data || []).map(entry => ({
                    keyId: entry.key_id,
                    endpoint: entry.endpoint,
                    requestMethod: entry.request_method,
                    responseStatus: entry.response_status,
                    clientIp: entry.client_ip,
                    userAgent: entry.user_agent,
                    requestId: entry.request_id,
                    requestDurationMs: entry.request_duration_ms
                })),
                total: count || 0
            };
        }
        catch (error) {
            logger.error('Failed to get error entries', { error, keyId, userId });
            throw error;
        }
    }
    async getUsagePatterns(keyId, userId) {
        try {
            const { data: keyData, error: keyError } = await this.supabase
                .from('api_keys')
                .select('id')
                .eq('id', keyId)
                .eq('created_by', userId)
                .single();
            if (keyError)
                throw keyError;
            if (!keyData)
                throw new Error('API key not found');
            const { data, error } = await this.supabase
                .from('key_usage_audit')
                .select('*')
                .eq('key_id', keyId)
                .order('timestamp', { ascending: false })
                .limit(10000);
            if (error)
                throw error;
            if (!data)
                return {
                    topEndpoints: [],
                    errorRateByEndpoint: [],
                    averageResponseTimeByEndpoint: [],
                    usageByHour: []
                };
            const endpointStats = new Map();
            const hourlyUsage = new Map();
            for (const entry of data) {
                const stats = endpointStats.get(entry.endpoint) || {
                    count: 0,
                    errors: 0,
                    totalDuration: 0
                };
                stats.count++;
                if (entry.response_status >= 400)
                    stats.errors++;
                stats.totalDuration += entry.request_duration_ms;
                endpointStats.set(entry.endpoint, stats);
                const hour = new Date(entry.timestamp).getHours();
                hourlyUsage.set(hour, (hourlyUsage.get(hour) || 0) + 1);
            }
            const topEndpoints = Array.from(endpointStats.entries())
                .map(([endpoint, stats]) => ({
                endpoint,
                count: stats.count
            }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);
            const errorRateByEndpoint = Array.from(endpointStats.entries())
                .map(([endpoint, stats]) => ({
                endpoint,
                errorRate: stats.errors / stats.count
            }))
                .sort((a, b) => b.errorRate - a.errorRate)
                .slice(0, 10);
            const averageResponseTimeByEndpoint = Array.from(endpointStats.entries())
                .map(([endpoint, stats]) => ({
                endpoint,
                avgDuration: stats.totalDuration / stats.count
            }))
                .sort((a, b) => b.avgDuration - a.avgDuration)
                .slice(0, 10);
            const usageByHour = Array.from(hourlyUsage.entries())
                .map(([hour, count]) => ({ hour, count }))
                .sort((a, b) => a.hour - b.hour);
            return {
                topEndpoints,
                errorRateByEndpoint,
                averageResponseTimeByEndpoint,
                usageByHour
            };
        }
        catch (error) {
            logger.error('Failed to get usage patterns', { error, keyId, userId });
            throw error;
        }
    }
}
//# sourceMappingURL=auditLog.service.js.map