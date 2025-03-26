import { createClient } from '@supabase/supabase-js';
import { performance } from 'perf_hooks';
let supabaseClient = null;
export function getSupabaseClient() {
    if (!supabaseClient) {
        if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('Supabase environment variables are not set');
        }
        supabaseClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    }
    return supabaseClient;
}
export function setSupabaseClient(client) {
    supabaseClient = client;
}
export async function trackRequestMetrics(operation, endpoint) {
    const startTime = performance.now();
    let success = true;
    let error;
    try {
        const result = await operation();
        return result;
    }
    catch (e) {
        success = false;
        error = e instanceof Error ? e.message : 'Unknown error';
        throw e;
    }
    finally {
        const duration = performance.now() - startTime;
        try {
            const metrics = {
                endpoint,
                duration,
                success,
                error,
                timestamp: new Date()
            };
            await getSupabaseClient().from('request_metrics').insert(metrics);
        }
        catch (err) {
            console.error('Failed to store request metrics:', err instanceof Error ? err.message : 'Unknown error');
        }
    }
}
export async function trackAPIUsage(endpoint) {
    const today = new Date().toISOString().split('T')[0];
    try {
        const { data: existingData } = await getSupabaseClient()
            .from('api_usage')
            .select('count')
            .eq('endpoint', endpoint)
            .eq('date', today)
            .single();
        if (existingData) {
            const metrics = {
                endpoint,
                date: today,
                count: existingData.count + 1
            };
            await getSupabaseClient()
                .from('api_usage')
                .update(metrics)
                .eq('endpoint', endpoint)
                .eq('date', today);
        }
        else {
            const metrics = {
                endpoint,
                date: today,
                count: 1
            };
            await getSupabaseClient()
                .from('api_usage')
                .insert(metrics);
        }
    }
    catch (err) {
        console.error('Failed to track API usage:', err instanceof Error ? err.message : 'Unknown error');
    }
}
export async function getErrorRate(endpoint, startDate, endDate) {
    try {
        const { data } = await getSupabaseClient()
            .from('request_metrics')
            .select('success')
            .eq('endpoint', endpoint)
            .gte('timestamp', startDate.toISOString())
            .lte('timestamp', endDate.toISOString());
        if (!data || data.length === 0) {
            return 0;
        }
        const failures = data.filter(record => !record.success).length;
        return failures / data.length;
    }
    catch (err) {
        console.error('Failed to get error rate:', err instanceof Error ? err.message : 'Unknown error');
        return 0;
    }
}
export async function getAverageLatency(endpoint, period = 60) {
    try {
        const cutoff = new Date(Date.now() - period * 60 * 1000);
        const { data } = await getSupabaseClient()
            .from('request_metrics')
            .select('duration')
            .eq('endpoint', endpoint)
            .gte('timestamp', cutoff.toISOString());
        if (!data || data.length === 0) {
            return 0;
        }
        const total = data.reduce((sum, record) => sum + record.duration, 0);
        return total / data.length;
    }
    catch (err) {
        console.error('Failed to get average latency:', err instanceof Error ? err.message : 'Unknown error');
        return 0;
    }
}
//# sourceMappingURL=monitoring.js.map