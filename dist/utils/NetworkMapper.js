export class NetworkMappingError extends Error {
    cause;
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'NetworkMappingError';
    }
}
function isPostgrestError(error) {
    return error instanceof Error && 'code' in error;
}
function formatErrorMessage(error) {
    return `${error.message}${error.details ? `: ${String(error.details)}` : ''}`;
}
export class NetworkMapper {
    supabase;
    logger;
    constructor(supabase, logger) {
        this.supabase = supabase;
        this.logger = logger;
    }
    async detectNetworks() {
        try {
            const { data: carriers, error } = await this.supabase
                .from('insurance_carriers')
                .select('name, website, contact_info');
            if (error) {
                if (isPostgrestError(error)) {
                    throw new NetworkMappingError(`Database error: ${error.message}`, error);
                }
                throw error;
            }
            const networkPatterns = [
                /network/i,
                /alliance/i,
                /association/i,
                /group/i,
                /ppo/i,
                /hmo/i
            ];
            const detectedNetworks = new Set();
            carriers?.forEach(carrier => {
                networkPatterns.forEach(pattern => {
                    const matches = carrier.name.match(pattern);
                    if (matches) {
                        detectedNetworks.add(carrier.name);
                    }
                });
                if (carrier.website) {
                    networkPatterns.forEach(pattern => {
                        if (pattern.test(carrier.website)) {
                            detectedNetworks.add(carrier.name);
                        }
                    });
                }
            });
            return Array.from(detectedNetworks);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during network detection';
            this.logger.error(formatErrorMessage({
                message: 'Error detecting networks',
                details: errorMessage
            }));
            throw new NetworkMappingError(errorMessage, error instanceof Error ? error : undefined);
        }
    }
    async createNetwork(networkData) {
        try {
            const { data, error } = await this.supabase
                .from('insurance_networks')
                .insert(networkData)
                .select('network_id')
                .single();
            if (error) {
                if (isPostgrestError(error)) {
                    throw new NetworkMappingError(`Database error: ${error.message}`, error);
                }
                throw error;
            }
            if (!data) {
                throw new NetworkMappingError('No network ID returned after creation');
            }
            return data.network_id;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during network creation';
            this.logger.error(formatErrorMessage({
                message: 'Error creating network',
                details: errorMessage
            }));
            throw new NetworkMappingError(errorMessage, error instanceof Error ? error : undefined);
        }
    }
    async createNetworkRelationship(relationship) {
        try {
            const { error } = await this.supabase
                .from('network_carrier_relationships')
                .insert(relationship);
            if (error) {
                if (isPostgrestError(error)) {
                    throw new NetworkMappingError(`Database error: ${error.message}`, error);
                }
                throw error;
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during relationship creation';
            this.logger.error(formatErrorMessage({
                message: 'Error creating network relationship',
                details: errorMessage
            }));
            throw new NetworkMappingError(errorMessage, error instanceof Error ? error : undefined);
        }
    }
    async validateNetworkRelationships() {
        const errors = [];
        try {
            const { data: unmappedCarriers, error: carrierError } = await this.supabase
                .from('insurance_carriers')
                .select('id, name')
                .not('id', 'in', (this.supabase
                .from('network_carrier_relationships')
                .select('carrier_id')));
            if (carrierError) {
                if (isPostgrestError(carrierError)) {
                    throw new NetworkMappingError(`Database error: ${carrierError.message}`, carrierError);
                }
                throw carrierError;
            }
            unmappedCarriers?.forEach(carrier => {
                errors.push(`Carrier ${carrier.name} (ID: ${carrier.id}) has no network relationships`);
            });
            const { data: relationships, error: relError } = await this.supabase
                .from('network_carrier_relationships')
                .select('relationship_id, network_id, carrier_id, effective_date, termination_date');
            if (relError) {
                if (isPostgrestError(relError)) {
                    throw new NetworkMappingError(`Database error: ${relError.message}`, relError);
                }
                throw relError;
            }
            relationships?.forEach(rel => {
                if (rel.effective_date && rel.termination_date) {
                    if (new Date(rel.effective_date) > new Date(rel.termination_date)) {
                        errors.push(`Invalid date range for relationship ID ${rel.relationship_id}`);
                    }
                }
            });
            return errors;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during relationship validation';
            this.logger.error(formatErrorMessage({
                message: 'Error validating network relationships',
                details: errorMessage
            }));
            throw new NetworkMappingError(errorMessage, error instanceof Error ? error : undefined);
        }
    }
    async generateMappingReport() {
        try {
            const { count: networkCount, error: networkError } = await this.supabase
                .from('insurance_networks')
                .select('network_id', { count: 'exact', head: true });
            if (networkError) {
                if (isPostgrestError(networkError)) {
                    throw new NetworkMappingError(`Database error: ${networkError.message}`, networkError);
                }
                throw networkError;
            }
            const { count: relationshipCount, error: relError } = await this.supabase
                .from('network_carrier_relationships')
                .select('relationship_id', { count: 'exact', head: true });
            if (relError) {
                if (isPostgrestError(relError)) {
                    throw new NetworkMappingError(`Database error: ${relError.message}`, relError);
                }
                throw relError;
            }
            const { count: unmappedCount, error: unmappedError } = await this.supabase
                .from('insurance_carriers')
                .select('id', { count: 'exact', head: true })
                .not('id', 'in', (this.supabase
                .from('network_carrier_relationships')
                .select('carrier_id')));
            if (unmappedError) {
                if (isPostgrestError(unmappedError)) {
                    throw new NetworkMappingError(`Database error: ${unmappedError.message}`, unmappedError);
                }
                throw unmappedError;
            }
            const validationErrors = await this.validateNetworkRelationships();
            return {
                total_networks: networkCount ?? 0,
                total_relationships: relationshipCount ?? 0,
                unmapped_carriers: unmappedCount ?? 0,
                validation_errors: validationErrors,
                timestamp: new Date()
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during report generation';
            this.logger.error(formatErrorMessage({
                message: 'Error generating mapping report',
                details: errorMessage
            }));
            throw new NetworkMappingError(errorMessage, error instanceof Error ? error : undefined);
        }
    }
}
//# sourceMappingURL=NetworkMapper.js.map