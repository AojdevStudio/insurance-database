import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { performance } from 'perf_hooks';

// Initialize Supabase client
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase environment variables are not set');
    }
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabaseClient;
}

export function setSupabaseClient(client: SupabaseClient) {
  supabaseClient = client;
}

// Types for monitoring data stored in Supabase tables
/** 
 * Represents a single request metric record in the request_metrics table
 * Used to track latency, success/failure, and errors for API endpoints
 */
interface RequestMetrics {
  endpoint: string;
  duration: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

/** 
 * Represents a daily API usage record in the api_usage table
 * Used to track the number of requests per endpoint per day
 */
interface APIUsageMetrics {
  endpoint: string;
  count: number;
  date: string;
}

/**
 * Tracks the latency and success/failure of a request
 * @param operation - The async operation to monitor
 * @param endpoint - Name of the endpoint or operation being monitored
 */
export async function trackRequestMetrics<T>(
  operation: () => Promise<T>,
  endpoint: string
): Promise<T> {
  const startTime = performance.now();
  let success = true;
  let error: string | undefined;

  try {
    const result = await operation();
    return result;
  } catch (e) {
    success = false;
    error = e instanceof Error ? e.message : 'Unknown error';
    throw e;
  } finally {
    const duration = performance.now() - startTime;
    
    // Store metrics in Supabase
    try {
      const metrics: RequestMetrics = {
        endpoint,
        duration,
        success,
        error,
        timestamp: new Date()
      };
      await getSupabaseClient().from('request_metrics').insert(metrics);
    } catch (err) {
      console.error('Failed to store request metrics:', err instanceof Error ? err.message : 'Unknown error');
    }
  }
}

/**
 * Tracks API usage for rate limiting and analytics
 * @param endpoint - Name of the endpoint being used
 */
export async function trackAPIUsage(endpoint: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Get current count for today
    const { data: existingData } = await getSupabaseClient()
      .from('api_usage')
      .select('count')
      .eq('endpoint', endpoint)
      .eq('date', today)
      .single();

    if (existingData) {
      // Update existing count
      const metrics: APIUsageMetrics = {
        endpoint,
        date: today,
        count: existingData.count + 1
      };
      await getSupabaseClient()
        .from('api_usage')
        .update(metrics)
        .eq('endpoint', endpoint)
        .eq('date', today);
    } else {
      // Create new entry
      const metrics: APIUsageMetrics = {
        endpoint,
        date: today,
        count: 1
      };
      await getSupabaseClient()
        .from('api_usage')
        .insert(metrics);
    }
  } catch (err) {
    console.error('Failed to track API usage:', err instanceof Error ? err.message : 'Unknown error');
  }
}

/**
 * Gets the error rate for a specific endpoint over a time period
 * @param endpoint - Name of the endpoint to check
 * @param startDate - Start of the time period
 * @param endDate - End of the time period
 * @returns Error rate as a decimal (0-1)
 */
export async function getErrorRate(
  endpoint: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
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
  } catch (err) {
    console.error('Failed to get error rate:', err instanceof Error ? err.message : 'Unknown error');
    return 0;
  }
}

/**
 * Gets the average latency for a specific endpoint over the last n minutes
 * @param endpoint - Name of the endpoint to check
 * @param period - Time period in minutes (default: 60)
 * @returns Average latency in milliseconds
 */
export async function getAverageLatency(
  endpoint: string,
  period: number = 60
): Promise<number> {
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
  } catch (err) {
    console.error('Failed to get average latency:', err instanceof Error ? err.message : 'Unknown error');
    return 0;
  }
} 