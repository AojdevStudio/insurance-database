import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
export class ProcedureService {
    static async listProcedures(options = {}) {
        const { page = 1, limit = 10, sort_by = 'code', sort_order = 'asc', category } = options;
        const offset = (page - 1) * limit;
        let query = supabase
            .from('procedures')
            .select('*', { count: 'exact' });
        if (category) {
            query = query.eq('category', category);
        }
        const { count } = await query;
        const { data: procedures, error } = await query
            .order(sort_by, { ascending: sort_order === 'asc' })
            .range(offset, offset + limit - 1);
        if (error)
            throw error;
        return {
            procedures: procedures,
            total: count || 0,
            page,
            limit,
            total_pages: Math.ceil((count || 0) / limit)
        };
    }
    static async searchProcedures(options = {}) {
        const { query = '', page = 1, limit = 10, sort_by = 'code', sort_order = 'asc', category } = options;
        const offset = (page - 1) * limit;
        let dbQuery = supabase
            .from('procedures')
            .select('*', { count: 'exact' })
            .or(`code.ilike.%${query}%,description.ilike.%${query}%`);
        if (category) {
            dbQuery = dbQuery.eq('category', category);
        }
        const { count } = await dbQuery;
        const { data: procedures, error } = await dbQuery
            .order(sort_by, { ascending: sort_order === 'asc' })
            .range(offset, offset + limit - 1);
        if (error)
            throw error;
        return {
            procedures: procedures,
            total: count || 0,
            page,
            limit,
            total_pages: Math.ceil((count || 0) / limit)
        };
    }
    static async getProcedureByCode(code) {
        const { data: procedure, error: procedureError } = await supabase
            .from('procedures')
            .select('*')
            .eq('code', code)
            .single();
        if (procedureError)
            throw procedureError;
        if (!procedure)
            throw new Error('Procedure not found');
        const { data: carrierRequirements, error: requirementsError } = await supabase
            .from('carrier_procedure_requirements')
            .select('*')
            .eq('procedure_id', procedure.id);
        if (requirementsError)
            throw requirementsError;
        const { data: docRequirements, error: docError } = await supabase
            .from('documentation_requirements')
            .select('*')
            .eq('procedure_id', procedure.id);
        if (docError)
            throw docError;
        return {
            ...procedure,
            carrier_requirements: carrierRequirements || [],
            documentation_requirements: docRequirements || []
        };
    }
    static async getProcedureRequirements(code, carrierId) {
        const query = supabase
            .from('procedure_requirements_view')
            .select('*')
            .eq('procedure_code', code);
        if (carrierId) {
            query.eq('carrier_id', carrierId);
        }
        const { data: requirements, error } = await query;
        if (error)
            throw error;
        if (!requirements?.length)
            throw new Error('No requirements found for procedure');
        return requirements;
    }
}
//# sourceMappingURL=procedure.service.js.map