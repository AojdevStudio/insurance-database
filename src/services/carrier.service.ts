import { supabase } from '../config/supabase.js';
import { Carrier } from '../types/carrier.js';

export class CarrierService {
  static async lookupCarrier(carrierId: string): Promise<Carrier | null> {
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