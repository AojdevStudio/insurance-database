import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { Logger } from './logging.js';

/** Custom error type for network mapping errors */
export class NetworkMappingError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'NetworkMappingError';
  }
}

/** Interface for network data */
interface NetworkData {
  network_name: string;
  contact_phone?: string;
  contact_email?: string;
  resource_url?: string;
  notes?: string;
}

/** Interface for carrier-network relationship */
interface CarrierNetworkRelationship {
  network_id: number;
  carrier_id: number;
  effective_date?: Date;
  termination_date?: Date;
  special_notes?: string;
  verification_required?: boolean;
}

/** Interface for mapping report */
interface MappingReport {
  total_networks: number;
  total_relationships: number;
  unmapped_carriers: number;
  validation_errors: string[];
  timestamp: Date;
}

/** Interface for carrier data from database */
interface CarrierData {
  id: number;
  name: string;
  website?: string;
  contact_info?: Record<string, unknown>;
}

/** Interface for network relationship data from database */
interface NetworkRelationshipData {
  relationship_id: number;
  network_id: number;
  carrier_id: number;
  effective_date?: string;
  termination_date?: string;
}

/** Interface for created network response */
interface NetworkResponse {
  network_id: number;
}

/** Type guard for PostgrestError */
function isPostgrestError(error: unknown): error is PostgrestError {
  return error instanceof Error && 'code' in error;
}

/** Interface for error logging */
interface ErrorDetails {
  message: string;
  details?: unknown;
}

/** Format error for logging */
function formatErrorMessage(error: ErrorDetails): string {
  return `${error.message}${error.details ? `: ${String(error.details)}` : ''}`;
}

export class NetworkMapper {
  private supabase: SupabaseClient;
  private logger: Logger;

  constructor(supabase: SupabaseClient, logger: Logger) {
    this.supabase = supabase;
    this.logger = logger;
  }

  /**
   * Detects potential networks from carrier data based on naming patterns and relationships
   * @returns Promise resolving to array of detected network names
   * @throws {NetworkMappingError} If network detection fails
   */
  async detectNetworks(): Promise<string[]> {
    try {
      const { data: carriers, error } = await this.supabase
        .from('insurance_carriers')
        .select<'name, website, contact_info', CarrierData>('name, website, contact_info');

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

      const detectedNetworks = new Set<string>();

      carriers?.forEach(carrier => {
        // Check carrier name for network patterns
        networkPatterns.forEach(pattern => {
          const matches = carrier.name.match(pattern);
          if (matches) {
            detectedNetworks.add(carrier.name);
          }
        });

        // Check website domain for network indicators
        if (carrier.website) {
          networkPatterns.forEach(pattern => {
            if (pattern.test(carrier.website!)) {
              detectedNetworks.add(carrier.name);
            }
          });
        }
      });

      return Array.from(detectedNetworks);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during network detection';
      this.logger.error(formatErrorMessage({
        message: 'Error detecting networks',
        details: errorMessage
      }));
      throw new NetworkMappingError(errorMessage, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Creates a new network in the database
   * @param networkData - Network information to create
   * @returns Promise resolving to created network ID
   * @throws {NetworkMappingError} If network creation fails
   */
  async createNetwork(networkData: NetworkData): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('insurance_networks')
        .insert(networkData)
        .select<'network_id', NetworkResponse>('network_id')
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during network creation';
      this.logger.error(formatErrorMessage({
        message: 'Error creating network',
        details: errorMessage
      }));
      throw new NetworkMappingError(errorMessage, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Creates a relationship between a network and a carrier
   * @param relationship - Network-carrier relationship data
   * @throws {NetworkMappingError} If relationship creation fails
   */
  async createNetworkRelationship(relationship: CarrierNetworkRelationship): Promise<void> {
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during relationship creation';
      this.logger.error(formatErrorMessage({
        message: 'Error creating network relationship',
        details: errorMessage
      }));
      throw new NetworkMappingError(errorMessage, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Validates network relationships for consistency and completeness
   * @returns Promise resolving to array of validation errors
   * @throws {NetworkMappingError} If validation fails
   */
  async validateNetworkRelationships(): Promise<string[]> {
    const errors: string[] = [];
    try {
      // Check for carriers without network relationships
      const { data: unmappedCarriers, error: carrierError } = await this.supabase
        .from('insurance_carriers')
        .select<'id, name', CarrierData>('id, name')
        .not('id', 'in', (
          this.supabase
            .from('network_carrier_relationships')
            .select('carrier_id')
        ));

      if (carrierError) {
        if (isPostgrestError(carrierError)) {
          throw new NetworkMappingError(`Database error: ${carrierError.message}`, carrierError);
        }
        throw carrierError;
      }

      unmappedCarriers?.forEach(carrier => {
        errors.push(`Carrier ${carrier.name} (ID: ${carrier.id}) has no network relationships`);
      });

      // Check for invalid dates in relationships
      const { data: relationships, error: relError } = await this.supabase
        .from('network_carrier_relationships')
        .select<'relationship_id, network_id, carrier_id, effective_date, termination_date', NetworkRelationshipData>('relationship_id, network_id, carrier_id, effective_date, termination_date');

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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during relationship validation';
      this.logger.error(formatErrorMessage({
        message: 'Error validating network relationships',
        details: errorMessage
      }));
      throw new NetworkMappingError(errorMessage, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Generates a report of network mapping status
   * @returns Promise resolving to mapping report object
   * @throws {NetworkMappingError} If report generation fails
   */
  async generateMappingReport(): Promise<MappingReport> {
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
        .not('id', 'in', (
          this.supabase
            .from('network_carrier_relationships')
            .select('carrier_id')
        ));

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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during report generation';
      this.logger.error(formatErrorMessage({
        message: 'Error generating mapping report',
        details: errorMessage
      }));
      throw new NetworkMappingError(errorMessage, error instanceof Error ? error : undefined);
    }
  }
} 