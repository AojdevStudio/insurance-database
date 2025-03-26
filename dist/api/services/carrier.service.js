import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
export class CarrierService {
    static async listCarriers(options = {}) {
        const { page = 1, limit = 10, sort_by = 'name', sort_order = 'asc' } = options;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const offset = (pageNum - 1) * limitNum;
        const { count } = await supabase
            .from('insurance_carriers')
            .select('*', { count: 'exact', head: true });
        const { data: carriers, error } = await supabase
            .from('insurance_carriers')
            .select('*')
            .order(sort_by, { ascending: sort_order === 'asc' })
            .range(offset, offset + limitNum - 1);
        if (error)
            throw error;
        return {
            carriers: carriers,
            total: count || 0,
            page: pageNum,
            limit: limitNum,
            total_pages: Math.ceil((count || 0) / limitNum)
        };
    }
    static async searchCarriers(options = {}) {
        const { query = '', page = 1, limit = 10, sort_by = 'name', sort_order = 'asc' } = options;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const offset = (pageNum - 1) * limitNum;
        const { count } = await supabase
            .from('insurance_carriers')
            .select('*', { count: 'exact', head: true })
            .ilike('name', `%${query}%`);
        const { data: carriers, error } = await supabase
            .from('insurance_carriers')
            .select('*')
            .ilike('name', `%${query}%`)
            .order(sort_by, { ascending: sort_order === 'asc' })
            .range(offset, offset + limitNum - 1);
        if (error)
            throw error;
        return {
            carriers: carriers,
            total: count || 0,
            page: pageNum,
            limit: limitNum,
            total_pages: Math.ceil((count || 0) / limitNum)
        };
    }
    static async getCarrierById(id) {
        const { data: carrier, error } = await supabase
            .from('insurance_carriers')
            .select('*')
            .eq('id', id)
            .single();
        if (error)
            throw error;
        if (!carrier)
            throw new Error('Carrier not found');
        return carrier;
    }
}
//# sourceMappingURL=carrier.service.js.map