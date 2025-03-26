import { validateCSV } from './csvValidator.js';
const VALID_CARRIER_TYPES = ['National', 'Medicare Advantage', 'TPA', 'Other'];
export async function parseCarrierCSV(csvContent) {
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
        const carrierMap = new Map();
        for (const record of validationResult.data) {
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
            const networkData = {
                network_name: record.network_name,
                plan_type: record.plan_type,
                effective_date: record.effective_date
            };
            if (carrierMap.has(record.carrier_name)) {
                const carrier = carrierMap.get(record.carrier_name);
                carrier.networks.push(networkData);
            }
            else {
                const carrierData = {
                    carrier_name: record.carrier_name,
                    carrier_type: record.carrier_type,
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
    }
    catch (error) {
        return {
            success: false,
            error: `Failed to parse CSV: ${error.message}`
        };
    }
}
//# sourceMappingURL=carrierParser.js.map