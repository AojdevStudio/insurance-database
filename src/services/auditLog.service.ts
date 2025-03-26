import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

export interface AuditLogEntry {
  keyId: string;
  endpoint: string;
  requestMethod: string;
  responseStatus: number;
  clientIp: string;
  userAgent?: string;
  requestId: string;
  requestDurationMs: number;
}

export class AuditLogService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Records an API request in the audit log
   * @param entry Audit log entry details
   */
  async logRequest(entry: AuditLogEntry): Promise<void> {
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

      if (error) throw error;
    } catch (error) {
      logger.error('Failed to record audit log entry', { error, entry });
      // Non-blocking error - we don't want to fail requests if audit logging fails
    }
  }

  /**
   * Gets audit log entries for a specific API key
   * @param keyId API key ID to get logs for
   * @param userId User requesting the logs
   * @param limit Maximum number of entries to return
   * @param offset Offset for pagination
   * @returns Array of audit log entries
   */
  async getKeyAuditLog(
    keyId: string,
    userId: string,
    limit = 100,
    offset = 0
  ): Promise<{
    entries: AuditLogEntry[];
    total: number;
  }> {
    try {
      // First verify the user owns the key
      const { data: keyData, error: keyError } = await this.supabase
        .from('api_keys')
        .select('id')
        .eq('id', keyId)
        .eq('created_by', userId)
        .single();

      if (keyError) throw keyError;
      if (!keyData) throw new Error('API key not found');

      // Get audit log entries
      const { data, error, count } = await this.supabase
        .from('key_usage_audit')
        .select('*', { count: 'exact' })
        .eq('key_id', keyId)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

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
    } catch (error) {
      logger.error('Failed to get audit log entries', { error, keyId, userId });
      throw error;
    }
  }

  /**
   * Gets error entries from the audit log
   * @param keyId API key ID to get errors for
   * @param userId User requesting the errors
   * @param limit Maximum number of entries to return
   * @param offset Offset for pagination
   * @returns Array of error entries
   */
  async getKeyErrors(
    keyId: string,
    userId: string,
    limit = 100,
    offset = 0
  ): Promise<{
    entries: AuditLogEntry[];
    total: number;
  }> {
    try {
      // First verify the user owns the key
      const { data: keyData, error: keyError } = await this.supabase
        .from('api_keys')
        .select('id')
        .eq('id', keyId)
        .eq('created_by', userId)
        .single();

      if (keyError) throw keyError;
      if (!keyData) throw new Error('API key not found');

      // Get error entries
      const { data, error, count } = await this.supabase
        .from('key_usage_audit')
        .select('*', { count: 'exact' })
        .eq('key_id', keyId)
        .gte('response_status', 400)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

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
    } catch (error) {
      logger.error('Failed to get error entries', { error, keyId, userId });
      throw error;
    }
  }

  /**
   * Gets usage patterns for an API key
   * @param keyId API key ID to get patterns for
   * @param userId User requesting the patterns
   * @returns Usage pattern analysis
   */
  async getUsagePatterns(
    keyId: string,
    userId: string
  ): Promise<{
    topEndpoints: Array<{ endpoint: string; count: number }>;
    errorRateByEndpoint: Array<{ endpoint: string; errorRate: number }>;
    averageResponseTimeByEndpoint: Array<{ endpoint: string; avgDuration: number }>;
    usageByHour: Array<{ hour: number; count: number }>;
  }> {
    try {
      // First verify the user owns the key
      const { data: keyData, error: keyError } = await this.supabase
        .from('api_keys')
        .select('id')
        .eq('id', keyId)
        .eq('created_by', userId)
        .single();

      if (keyError) throw keyError;
      if (!keyData) throw new Error('API key not found');

      // Get all audit entries for analysis
      const { data, error } = await this.supabase
        .from('key_usage_audit')
        .select('*')
        .eq('key_id', keyId)
        .order('timestamp', { ascending: false })
        .limit(10000); // Analyze last 10,000 requests

      if (error) throw error;
      if (!data) return {
        topEndpoints: [],
        errorRateByEndpoint: [],
        averageResponseTimeByEndpoint: [],
        usageByHour: []
      };

      // Process the data
      const endpointStats = new Map<string, { 
        count: number;
        errors: number;
        totalDuration: number;
      }>();

      const hourlyUsage = new Map<number, number>();

      for (const entry of data) {
        // Update endpoint stats
        const stats = endpointStats.get(entry.endpoint) || {
          count: 0,
          errors: 0,
          totalDuration: 0
        };
        stats.count++;
        if (entry.response_status >= 400) stats.errors++;
        stats.totalDuration += entry.request_duration_ms;
        endpointStats.set(entry.endpoint, stats);

        // Update hourly usage
        const hour = new Date(entry.timestamp).getHours();
        hourlyUsage.set(hour, (hourlyUsage.get(hour) || 0) + 1);
      }

      // Format results
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
    } catch (error) {
      logger.error('Failed to get usage patterns', { error, keyId, userId });
      throw error;
    }
  }
} 