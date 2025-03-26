export interface Database {
  public: {
    Tables: {
      insurance_carriers: {
        Row: {
          id: number;
          name: string;
          code: string | null;
          contact_info: {
            phone?: string;
            email?: string;
            address?: string;
          } | null;
          website: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['insurance_carriers']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['insurance_carriers']['Insert']>;
      };
      // Add other tables as needed
    };
  };
} 