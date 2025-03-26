import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client lazily
let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase URL and service role key are required');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

// Function to set Supabase client (for testing)
export function setSupabaseClientForLogging(client: SupabaseClient) {
  supabase = client;
}

// Log levels
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

// Log entry interface
interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
  service?: string;
}

/**
 * Centralized logging service
 */
export class Logger {
  private service: string;

  constructor(service: string) {
    this.service = service;
  }

  /**
   * Logs a message with the specified level
   * @param level - Log level
   * @param message - Log message
   * @param context - Additional context
   */
  private async log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      service: this.service
    };

    try {
      const { error } = await getSupabaseClient()
        .from('logs')
        .insert(entry);

      if (error) {
        console.error('Failed to store log:', error);
        // Fallback to console
        console.log(JSON.stringify(entry));
      }
    } catch (error) {
      console.error('Error logging to Supabase:', error);
      // Fallback to console
      console.log(JSON.stringify(entry));
    }
  }

  /**
   * Logs a debug message
   * @param message - Debug message
   * @param context - Additional context
   */
  public debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context).catch(console.error);
  }

  /**
   * Logs an info message
   * @param message - Info message
   * @param context - Additional context
   */
  public info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context).catch(console.error);
  }

  /**
   * Logs a warning message
   * @param message - Warning message
   * @param context - Additional context
   */
  public warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context).catch(console.error);
  }

  /**
   * Logs an error message
   * @param message - Error message
   * @param error - Error object
   * @param context - Additional context
   */
  public error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ): void {
    const errorContext = {
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    this.log(LogLevel.ERROR, message, errorContext).catch(console.error);
  }

  /**
   * Gets logs for a specific service and level
   * @param level - Optional log level to filter by
   * @param limit - Maximum number of logs to return
   * @returns Array of log entries
   */
  public async getLogs(
    level?: LogLevel,
    limit: number = 100
  ): Promise<LogEntry[]> {
    try {
      let query = getSupabaseClient()
        .from('logs')
        .select('*')
        .eq('service', this.service)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (level) {
        query = query.eq('level', level);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching logs:', error);
      return [];
    }
  }
} 