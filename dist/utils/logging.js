import { createClient } from '@supabase/supabase-js';
let supabase = null;
function getSupabaseClient() {
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
export function setSupabaseClientForLogging(client) {
    supabase = client;
}
export var LogLevel;
(function (LogLevel) {
    LogLevel["DEBUG"] = "DEBUG";
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
})(LogLevel || (LogLevel = {}));
export class Logger {
    service;
    constructor(service) {
        this.service = service;
    }
    async log(level, message, context) {
        const entry = {
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
                console.log(JSON.stringify(entry));
            }
        }
        catch (error) {
            console.error('Error logging to Supabase:', error);
            console.log(JSON.stringify(entry));
        }
    }
    debug(message, context) {
        this.log(LogLevel.DEBUG, message, context).catch(console.error);
    }
    info(message, context) {
        this.log(LogLevel.INFO, message, context).catch(console.error);
    }
    warn(message, context) {
        this.log(LogLevel.WARN, message, context).catch(console.error);
    }
    error(message, error, context) {
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
    async getLogs(level, limit = 100) {
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
            if (error)
                throw error;
            return data || [];
        }
        catch (error) {
            console.error('Error fetching logs:', error);
            return [];
        }
    }
}
//# sourceMappingURL=logging.js.map