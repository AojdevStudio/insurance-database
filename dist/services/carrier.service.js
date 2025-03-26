import { supabase } from '../config/supabase.js';
export class CarrierService {
    static async lookupCarrier(carrierId) {
        const { data, error } = await supabase
            .from('carriers')
            .select('*')
            .eq('id', carrierId)
            .single();
        if (error) {
            throw error;
        }
        return data;
    }
}
//# sourceMappingURL=carrier.service.js.map