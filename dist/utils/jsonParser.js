import { validateJSON } from './jsonValidator.js';
import { Logger } from './logging.js';
const logger = new Logger('jsonParser');
export async function parseAndImportJSON(jsonContent, supabase) {
    const progress = {
        total: 1,
        processed: 0,
        successful: 0,
        failed: 0,
        errors: []
    };
    try {
        const validationResult = await validateJSON(jsonContent);
        if (!validationResult.isValid || !validationResult.data) {
            const error = validationResult.errors.map(e => e.message).join(', ');
            progress.failed = 1;
            progress.processed = 1;
            progress.errors.push({
                carrier: 'Unknown',
                error
            });
            return {
                success: false,
                progress,
                error
            };
        }
        const carrierData = validationResult.data;
        const { data: carrier, error: carrierError } = await supabase
            .from('insurance_carriers')
            .select('id')
            .eq('carrier_name', carrierData.carrier_name)
            .maybeSingle();
        if (carrierError) {
            throw new Error(`Failed to check carrier existence: ${carrierError.message}`);
        }
        let carrierId;
        if (carrier) {
            carrierId = carrier.id;
            const { error: updateError } = await supabase
                .from('insurance_carriers')
                .update({
                carrier_type: carrierData.carrier_type,
                payer_id: carrierData.payer_id,
                claims_address: carrierData.claims_address,
                phone_number: carrierData.phone_number,
                updated_at: new Date().toISOString()
            })
                .eq('id', carrierId);
            if (updateError) {
                throw new Error(`Failed to update carrier: ${updateError.message}`);
            }
        }
        else {
            const { data: newCarrier, error: insertError } = await supabase
                .from('insurance_carriers')
                .insert({
                carrier_name: carrierData.carrier_name,
                carrier_type: carrierData.carrier_type,
                payer_id: carrierData.payer_id,
                claims_address: carrierData.claims_address,
                phone_number: carrierData.phone_number
            })
                .select()
                .single();
            if (insertError || !newCarrier) {
                throw new Error(`Failed to insert carrier: ${insertError?.message}`);
            }
            carrierId = newCarrier.id;
        }
        for (const network of carrierData.networks) {
            const { error: networkError } = await supabase
                .from('insurance_networks')
                .upsert({
                carrier_id: carrierId,
                network_name: network.network_name,
                plan_type: network.plan_type,
                effective_date: network.effective_date
            });
            if (networkError) {
                throw new Error(`Failed to import network ${network.network_name}: ${networkError.message}`);
            }
        }
        if (carrierData.procedures) {
            for (const procedure of carrierData.procedures) {
                const { error: procedureError } = await supabase
                    .from('procedures')
                    .upsert({
                    carrier_id: carrierId,
                    code: procedure.code,
                    description: procedure.description,
                    requirements: procedure.requirements
                });
                if (procedureError) {
                    throw new Error(`Failed to import procedure ${procedure.code}: ${procedureError.message}`);
                }
            }
        }
        if (carrierData.guidelines) {
            for (const guideline of carrierData.guidelines) {
                const { error: guidelineError } = await supabase
                    .from('guidelines')
                    .upsert({
                    carrier_id: carrierId,
                    title: guideline.title,
                    content: guideline.content,
                    effective_date: guideline.effective_date
                });
                if (guidelineError) {
                    throw new Error(`Failed to import guideline ${guideline.title}: ${guidelineError.message}`);
                }
            }
        }
        if (carrierData.appeal_procedures) {
            const { error: appealError } = await supabase
                .from('appeal_procedures')
                .upsert({
                carrier_id: carrierId,
                first_level: carrierData.appeal_procedures.first_level,
                second_level: carrierData.appeal_procedures.second_level,
                external_review: carrierData.appeal_procedures.external_review
            });
            if (appealError) {
                throw new Error(`Failed to import appeal procedures: ${appealError.message}`);
            }
        }
        progress.successful = 1;
        progress.processed = 1;
        logger.info('Successfully imported carrier data', {
            carrier_name: carrierData.carrier_name,
            context: 'jsonParser.parseAndImportJSON'
        });
        return {
            success: true,
            progress
        };
    }
    catch (error) {
        progress.failed = 1;
        progress.processed = 1;
        progress.errors.push({
            carrier: 'Unknown',
            error: error.message
        });
        logger.error('Failed to import carrier data', error, {
            context: 'jsonParser.parseAndImportJSON'
        });
        return {
            success: false,
            progress,
            error: error.message
        };
    }
}
//# sourceMappingURL=jsonParser.js.map