import { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError } from '../errors/database.error.js';
import { logger } from '../utils/logger.js';

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
}

export interface RateLimitResult {
  isAllowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  windowSize: string;
}

export class RateLimitService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * Checks if a request should be allowed based on rate limits
   * @param keyId API key ID
   * @param config Rate limit configuration
   * @returns Rate limit check result
   */
  async checkRateLimit(keyId: string, config: RateLimitConfig): Promise<RateLimitResult> {
    try {
      // Check all time windows
      const results = await Promise.all([
        this.checkWindow(keyId, 'minute', config.requestsPerMinute),
        this.checkWindow(keyId, 'hour', config.requestsPerHour),
        this.checkWindow(keyId, 'day', config.requestsPerDay)
      ]);

      // Find the most restrictive limit
      const mostRestrictive = results.reduce((prev, curr) => {
        if (!prev) return curr;
        if (curr.remaining < prev.remaining) return curr;
        return prev;
      });

      return mostRestrictive;
    } catch (error) {
      logger.error('Failed to check rate limit', { error, keyId });
      // Default to allowing the request in case of errors
      return {
        isAllowed: true,
        limit: 0,
        remaining: 0,
        resetAt: new Date(),
        windowSize: 'unknown'
      };
    }
  }

  /**
   * Records a request for rate limiting
   * @param keyId API key ID
   * @returns void
   */
  async recordRequest(keyId: string): Promise<void> {
    try {
      const now = new Date();
      const windows = this.getTimeWindows(now);

      // Record request in all time windows
      await Promise.all(
        Object.entries(windows).map(([windowSize, windowStart]) =>
          this.incrementWindow(keyId, windowStart)
        )
      );
    } catch (error) {
      logger.error('Failed to record request for rate limiting', { error, keyId });
      // Non-blocking error - we don't want to fail requests if rate limiting fails
    }
  }

  /**
   * Checks rate limit for a specific time window
   * @param keyId API key ID
   * @param windowSize Size of the window (minute, hour, day)
   * @param limit Request limit for the window
   * @returns Rate limit check result
   */
  private async checkWindow(
    keyId: string,
    windowSize: 'minute' | 'hour' | 'day',
    limit: number
  ): Promise<RateLimitResult> {
    const now = new Date();
    const windows = this.getTimeWindows(now);
    const windowStart = windows[windowSize];

    const { data, error } = await this.supabase
      .from('key_rate_limits')
      .select('request_count')
      .eq('key_id', keyId)
      .eq('window_start', windowStart.toISOString())
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      throw error;
    }

    const current = data?.request_count || 0;
    const remaining = Math.max(0, limit - current);
    const resetAt = this.getWindowReset(now, windowSize);

    return {
      isAllowed: current < limit,
      limit,
      remaining,
      resetAt,
      windowSize
    };
  }

  /**
   * Increments the request count for a time window
   * @param keyId API key ID
   * @param windowStart Start of the time window
   */
  private async incrementWindow(keyId: string, windowStart: Date): Promise<void> {
    const { error } = await this.supabase.rpc('increment_rate_limit', {
      p_key_id: keyId,
      p_window_start: windowStart.toISOString()
    });

    if (error) throw error;
  }

  /**
   * Gets the start times for all rate limit windows
   * @param now Current time
   * @returns Object with window start times
   */
  private getTimeWindows(now: Date): Record<string, Date> {
    const minute = new Date(now);
    minute.setSeconds(0, 0);

    const hour = new Date(minute);
    hour.setMinutes(0);

    const day = new Date(hour);
    day.setHours(0);

    return {
      minute,
      hour,
      day
    };
  }

  /**
   * Gets the reset time for a rate limit window
   * @param now Current time
   * @param windowSize Size of the window
   * @returns Reset time
   */
  private getWindowReset(now: Date, windowSize: string): Date {
    const reset = new Date(now);

    switch (windowSize) {
      case 'minute':
        reset.setSeconds(0, 0);
        reset.setMinutes(reset.getMinutes() + 1);
        break;
      case 'hour':
        reset.setSeconds(0, 0);
        reset.setMinutes(0);
        reset.setHours(reset.getHours() + 1);
        break;
      case 'day':
        reset.setSeconds(0, 0);
        reset.setMinutes(0);
        reset.setHours(0);
        reset.setDate(reset.getDate() + 1);
        break;
    }

    return reset;
  }
} 