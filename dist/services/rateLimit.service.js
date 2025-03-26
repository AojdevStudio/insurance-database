import { logger } from '../utils/logger.js';
export class RateLimitService {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async checkRateLimit(keyId, config) {
        try {
            const results = await Promise.all([
                this.checkWindow(keyId, 'minute', config.requestsPerMinute),
                this.checkWindow(keyId, 'hour', config.requestsPerHour),
                this.checkWindow(keyId, 'day', config.requestsPerDay)
            ]);
            const mostRestrictive = results.reduce((prev, curr) => {
                if (!prev)
                    return curr;
                if (curr.remaining < prev.remaining)
                    return curr;
                return prev;
            });
            return mostRestrictive;
        }
        catch (error) {
            logger.error('Failed to check rate limit', { error, keyId });
            return {
                isAllowed: true,
                limit: 0,
                remaining: 0,
                resetAt: new Date(),
                windowSize: 'unknown'
            };
        }
    }
    async recordRequest(keyId) {
        try {
            const now = new Date();
            const windows = this.getTimeWindows(now);
            await Promise.all(Object.entries(windows).map(([windowSize, windowStart]) => this.incrementWindow(keyId, windowStart)));
        }
        catch (error) {
            logger.error('Failed to record request for rate limiting', { error, keyId });
        }
    }
    async checkWindow(keyId, windowSize, limit) {
        const now = new Date();
        const windows = this.getTimeWindows(now);
        const windowStart = windows[windowSize];
        const { data, error } = await this.supabase
            .from('key_rate_limits')
            .select('request_count')
            .eq('key_id', keyId)
            .eq('window_start', windowStart.toISOString())
            .single();
        if (error && error.code !== 'PGRST116') {
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
    async incrementWindow(keyId, windowStart) {
        const { error } = await this.supabase.rpc('increment_rate_limit', {
            p_key_id: keyId,
            p_window_start: windowStart.toISOString()
        });
        if (error)
            throw error;
    }
    getTimeWindows(now) {
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
    getWindowReset(now, windowSize) {
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
//# sourceMappingURL=rateLimit.service.js.map