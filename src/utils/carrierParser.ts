import { validateCSV } from './csvValidator.js';

export interface NetworkData {
  network_name: string;
  plan_type: string;
  effective_date: string;
}

export interface CarrierData {
  carrier_name: string;
  carrier_type: 'National' | 'Medicare Advantage' | 'TPA' | 'Other';
  payer_id: string | null;
  claims_address: string | null;
  phone_number: string | null;
  networks: NetworkData[];
}

export interface CarrierImportResult {
  success: boolean;
  carriers?: CarrierData[];
  error?: string;
}

const VALID_CARRIER_TYPES = ['National', 'Medicare Advantage', 'TPA', 'Other'];

/**
 * Parses a CSV string containing carrier data and returns structured carrier objects
 * @param csvContent - The CSV content as a string
 * @returns Promise<CarrierImportResult> - The parsed carrier data or error
 */
export async function parseCarrierCSV(csvContent: string): Promise<CarrierImportResult> {
  // First validate the CSV structure
  const validationResult = await validateCSV(csvContent);
  if (!validationResult.isValid) {
    return {
      success: false,
      error: `CSV validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`
    };
  }

  if (!validationResult.data || validationResult.data.length === 0) {
    return {
      success: false,
      error: 'CSV file is empty'
    };
  }

  try {
    // Group records by carrier
    const carrierMap = new Map<string, CarrierData>();
    
    for (const record of validationResult.data) {
      // Validate carrier type
      if (!record.carrier_type) {
        return {
          success: false,
          error: 'Missing carrier_type'
        };
      }

      if (!VALID_CARRIER_TYPES.includes(record.carrier_type)) {
        return {
          success: false,
          error: `Invalid carrier_type: ${record.carrier_type}. Expected one of: ${VALID_CARRIER_TYPES.join(', ')}`
        };
      }

      const networkData: NetworkData = {
        network_name: record.network_name,
        plan_type: record.plan_type,
        effective_date: record.effective_date
      };

      if (carrierMap.has(record.carrier_name)) {
        // Add network to existing carrier
        const carrier = carrierMap.get(record.carrier_name)!;
        carrier.networks.push(networkData);
      } else {
        // Create new carrier entry
        const carrierData: CarrierData = {
          carrier_name: record.carrier_name,
          carrier_type: record.carrier_type as CarrierData['carrier_type'],
          payer_id: record.payer_id || null,
          claims_address: record.claims_address || null,
          phone_number: record.phone_number || null,
          networks: [networkData]
        };
        carrierMap.set(record.carrier_name, carrierData);
      }
    }

    return {
      success: true,
      carriers: Array.from(carrierMap.values())
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse CSV: ${(error as Error).message}`
    };
  }
} 