import { SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import { Logger } from './logging.js';
import { StringUtils } from './StringUtils.js';
import { stateMappings } from '../config/stateMappings.js';
import { countryMappings } from '../config/countryMappings.js';

/** Custom error type for data normalization errors */
export class DataNormalizationError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'DataNormalizationError';
  }
}

/** Interface for standardized address components */
export interface StandardizedAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  normalized: boolean;
}

/** Interface for formatted phone number components */
export interface PhoneNumberFormat {
  countryCode: string;
  areaCode: string;
  number: string;
  formatted: string;
}

/** Interface for name matching results */
export interface NameMatchResult {
  originalName: string;
  normalizedName: string;
  confidence: number;
  possibleDuplicates: string[];
}

/** Interface for data cleaning rules */
export interface DataCleaningRules {
  trimWhitespace?: boolean;
  removeSpecialCharacters?: boolean;
  convertToUpperCase?: boolean;
  standardizeAbbreviations?: boolean;
}

/** Type for primitive values that can be cleaned */
export type CleanableValue = string | number | boolean | null | undefined;

/** Type for arrays that can be cleaned */
export type CleanableArray = Array<CleanableValue | CleanableObject>;

/** Interface for objects that can be cleaned */
export interface CleanableObject {
  [key: string]: CleanableValue | CleanableObject | CleanableArray;
}

/** Interface for similar name match results from database */
export interface SimilarNameMatch {
  name: string;
  similarity: number;
}

/** Interface for carrier name query result */
export interface CarrierNameResult {
  name: string;
}

/** Type guard for PostgrestError */
function isPostgrestError(error: unknown): error is PostgrestError {
  return error instanceof Error && 'code' in error;
}

/** Type guard for CleanableObject */
function isCleanableObject(value: unknown): value is CleanableObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Interface for error details */
interface ErrorDetails {
  message: string;
  details?: unknown;
}

/** Format error for logging */
function formatErrorMessage(error: ErrorDetails): string {
  return `${error.message}${error.details ? `: ${String(error.details)}` : ''}`;
}

export class DataNormalizer {
  private supabase: SupabaseClient;
  private logger: Logger;

  constructor(supabase: SupabaseClient, logger: Logger) {
    this.supabase = supabase;
    this.logger = logger;
  }

  /**
   * Standardizes an address using consistent formatting and validation
   * @param address - The address string to standardize
   * @returns A promise that resolves to a standardized address object
   * @throws {DataNormalizationError} If the address cannot be standardized
   */
  async standardizeAddress(address: string): Promise<StandardizedAddress> {
    try {
      if (!address.trim()) {
        throw new DataNormalizationError('Address cannot be empty');
      }

      // Split address into components
      const components = this.parseAddressComponents(address);
      
      // Validate and standardize each component
      const street = this.standardizeStreet(components.street);
      const city = this.standardizeCity(components.city);
      const state = this.standardizeState(components.state);
      const zipCode = this.standardizeZipCode(components.zipCode);
      const country = this.standardizeCountry(components.country || 'USA');

      // Check if address was successfully normalized
      const normalized = Boolean(street && city && (state || country !== 'USA') && (zipCode || country !== 'USA'));

      return {
        street,
        city,
        state,
        zipCode,
        country,
        normalized
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during address standardization';
      this.logger.error(formatErrorMessage({
        message: 'Error standardizing address',
        details: errorMessage
      }));
      throw new DataNormalizationError(errorMessage, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Formats a phone number into a consistent format
   * @param phone - The phone number string to format
   * @returns A formatted phone number object
   * @throws {DataNormalizationError} If the phone number is invalid
   */
  formatPhoneNumber(phone: string): PhoneNumberFormat {
    try {
      // Remove all non-numeric characters
      const cleaned = phone.replace(/\D/g, '');

      if (cleaned.length < 10) {
        throw new DataNormalizationError('Invalid phone number: must have at least 10 digits');
      }

      // Extract components
      const countryCode = cleaned.length > 10 ? cleaned.slice(0, cleaned.length - 10) : '1';
      const remaining = cleaned.slice(-10);
      const areaCode = remaining.slice(0, 3);
      const number = remaining.slice(3);

      // Format the full number
      const formatted = `+${countryCode} (${areaCode}) ${number.slice(0, 3)}-${number.slice(3)}`;

      return {
        countryCode,
        areaCode,
        number,
        formatted
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during phone number formatting';
      this.logger.error(formatErrorMessage({
        message: 'Error formatting phone number',
        details: errorMessage
      }));
      throw new DataNormalizationError(errorMessage, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Deduplicates a name by checking against existing names in the database
   * @param name - The name string to deduplicate
   * @returns A promise that resolves to a name match result
   * @throws {DataNormalizationError} If the name cannot be deduplicated
   */
  async deduplicateName(name: string): Promise<NameMatchResult> {
    try {
      const normalizedName = this.normalizeNameString(name);

      // Check for exact matches
      const { data: exactMatches, error: exactError } = await this.supabase
        .from('insurance_carriers')
        .select<'name', { name: string }>('name')
        .ilike('name', normalizedName);

      if (exactError) {
        if (isPostgrestError(exactError)) {
          throw new DataNormalizationError(`Database error: ${exactError.message}`, exactError);
        }
        throw exactError;
      }

      // Check for similar names using trigram similarity
      const { data: similarMatches, error: similarError } = await this.supabase
        .rpc('find_similar_names', { 
          search_name: normalizedName,
          similarity_threshold: 0.7
        }) as unknown as { data: SimilarNameMatch[] | null; error: PostgrestError | null };

      if (similarError) {
        if (isPostgrestError(similarError)) {
          throw new DataNormalizationError(`Database error: ${similarError.message}`, similarError);
        }
        throw similarError;
      }

      // Extract names from similar matches for confidence calculation
      const similarNames = (similarMatches || []).map(m => m.name);

      // Calculate confidence based on exact and similar matches
      const confidence = this.calculateNameMatchConfidence(
        normalizedName,
        exactMatches?.map((m: CarrierNameResult) => m.name) || [],
        similarNames
      );

      return {
        originalName: name,
        normalizedName,
        confidence,
        possibleDuplicates: similarNames
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during name deduplication';
      this.logger.error(formatErrorMessage({
        message: 'Error deduplicating name',
        details: errorMessage
      }));
      throw new DataNormalizationError(errorMessage, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Cleans data according to specified rules
   * @param data - The data object to clean
   * @param rules - Optional cleaning rules to apply
   * @param depth - Current recursion depth
   * @param seen - Set of seen objects to prevent circular references
   * @returns A promise that resolves to the cleaned data object
   * @throws {DataNormalizationError} If the data cannot be cleaned
   */
  async cleanData(
    data: CleanableObject,
    rules: DataCleaningRules = {},
    depth: number = 0,
    seen: Set<unknown> = new Set()
  ): Promise<CleanableObject> {
    try {
      // Check for circular references and maximum depth
      if (depth > 100) {
        throw new DataNormalizationError('Maximum object depth exceeded');
      }
      if (seen.has(data)) {
        throw new DataNormalizationError('Circular reference detected');
      }
      seen.add(data);

      const cleaned: CleanableObject = {};

      for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined) {
          cleaned[key] = value;
        } else if (typeof value === 'string') {
          let cleanedValue = value;

          if (rules.trimWhitespace) {
            cleanedValue = cleanedValue.trim();
          }

          if (rules.removeSpecialCharacters) {
            cleanedValue = cleanedValue.replace(/[^\w\s-]/g, '');
          }

          if (rules.convertToUpperCase) {
            cleanedValue = cleanedValue.toUpperCase();
          }

          if (rules.standardizeAbbreviations) {
            cleanedValue = StringUtils.standardizeAbbreviations(cleanedValue);
          }

          cleaned[key] = cleanedValue;
        } else if (Array.isArray(value)) {
          const cleanedArray = await Promise.all(
            value.map(async (item) => {
              if (isCleanableObject(item)) {
                return this.cleanData(item, rules, depth + 1, seen);
              }
              return item;
            })
          );
          cleaned[key] = cleanedArray as CleanableArray;
        } else if (isCleanableObject(value)) {
          cleaned[key] = await this.cleanData(value, rules, depth + 1, seen);
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          cleaned[key] = value;
        }
      }

      seen.delete(data);
      return cleaned;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during data cleaning';
      this.logger.error(formatErrorMessage({
        message: 'Error cleaning data',
        details: errorMessage
      }));
      throw new DataNormalizationError(errorMessage, error instanceof Error ? error : undefined);
    }
  }

  // Private helper methods

  private parseAddressComponents(address: string): {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
  } {
    // Basic address parsing - this should be enhanced with a proper address parser library
    const parts = address.split(',').map(p => p.trim());
    return {
      street: parts[0] || '',
      city: parts[1] || '',
      state: (parts[2] || '').split(' ')[0] || '',
      zipCode: (parts[2] || '').split(' ')[1] || '',
      country: parts[3]
    };
  }

  private standardizeStreet(street: string): string {
    if (!street.trim()) return '';
    return StringUtils.standardizeAbbreviations(street.trim());
  }

  private standardizeCity(city: string): string {
    if (!city.trim()) return '';
    return city
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (m: string) => m.toUpperCase());
  }

  private standardizeState(state: string): string {
    const normalized = state.toLowerCase().trim();
    return stateMappings[normalized] || state.toUpperCase();
  }

  private standardizeZipCode(zipCode: string): string {
    const cleaned = zipCode.replace(/\D/g, '');
    if (!cleaned) return '';
    return cleaned.length > 5 ? `${cleaned.slice(0, 5)}-${cleaned.slice(5)}` : cleaned;
  }

  private standardizeCountry(country: string): string {
    return countryMappings[country.toLowerCase().trim()] || country.toUpperCase();
  }

  private normalizeNameString(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateNameMatchConfidence(
    normalizedName: string,
    exactMatches: string[],
    similarMatches: string[]
  ): number {
    if (exactMatches.length > 0) return 1.0;
    if (similarMatches.length === 0) return 0.0;

    // Calculate average similarity score
    const totalSimilarity = similarMatches.reduce((sum: number, match: string) => {
      return sum + StringUtils.calculateStringSimilarity(normalizedName, match);
    }, 0);

    return totalSimilarity / similarMatches.length;
  }
} 