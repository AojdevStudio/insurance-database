import { StringUtils } from './StringUtils.js';
import { stateMappings } from '../config/stateMappings.js';
import { countryMappings } from '../config/countryMappings.js';
export class DataNormalizationError extends Error {
    cause;
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'DataNormalizationError';
    }
}
function isPostgrestError(error) {
    return error instanceof Error && 'code' in error;
}
function isCleanableObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function formatErrorMessage(error) {
    return `${error.message}${error.details ? `: ${String(error.details)}` : ''}`;
}
export class DataNormalizer {
    supabase;
    logger;
    constructor(supabase, logger) {
        this.supabase = supabase;
        this.logger = logger;
    }
    async standardizeAddress(address) {
        try {
            if (!address.trim()) {
                throw new DataNormalizationError('Address cannot be empty');
            }
            const components = this.parseAddressComponents(address);
            const street = this.standardizeStreet(components.street);
            const city = this.standardizeCity(components.city);
            const state = this.standardizeState(components.state);
            const zipCode = this.standardizeZipCode(components.zipCode);
            const country = this.standardizeCountry(components.country || 'USA');
            const normalized = Boolean(street && city && (state || country !== 'USA') && (zipCode || country !== 'USA'));
            return {
                street,
                city,
                state,
                zipCode,
                country,
                normalized
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during address standardization';
            this.logger.error(formatErrorMessage({
                message: 'Error standardizing address',
                details: errorMessage
            }));
            throw new DataNormalizationError(errorMessage, error instanceof Error ? error : undefined);
        }
    }
    formatPhoneNumber(phone) {
        try {
            const cleaned = phone.replace(/\D/g, '');
            if (cleaned.length < 10) {
                throw new DataNormalizationError('Invalid phone number: must have at least 10 digits');
            }
            const countryCode = cleaned.length > 10 ? cleaned.slice(0, cleaned.length - 10) : '1';
            const remaining = cleaned.slice(-10);
            const areaCode = remaining.slice(0, 3);
            const number = remaining.slice(3);
            const formatted = `+${countryCode} (${areaCode}) ${number.slice(0, 3)}-${number.slice(3)}`;
            return {
                countryCode,
                areaCode,
                number,
                formatted
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during phone number formatting';
            this.logger.error(formatErrorMessage({
                message: 'Error formatting phone number',
                details: errorMessage
            }));
            throw new DataNormalizationError(errorMessage, error instanceof Error ? error : undefined);
        }
    }
    async deduplicateName(name) {
        try {
            const normalizedName = this.normalizeNameString(name);
            const { data: exactMatches, error: exactError } = await this.supabase
                .from('insurance_carriers')
                .select('name')
                .ilike('name', normalizedName);
            if (exactError) {
                if (isPostgrestError(exactError)) {
                    throw new DataNormalizationError(`Database error: ${exactError.message}`, exactError);
                }
                throw exactError;
            }
            const { data: similarMatches, error: similarError } = await this.supabase
                .rpc('find_similar_names', {
                search_name: normalizedName,
                similarity_threshold: 0.7
            });
            if (similarError) {
                if (isPostgrestError(similarError)) {
                    throw new DataNormalizationError(`Database error: ${similarError.message}`, similarError);
                }
                throw similarError;
            }
            const similarNames = (similarMatches || []).map(m => m.name);
            const confidence = this.calculateNameMatchConfidence(normalizedName, exactMatches?.map((m) => m.name) || [], similarNames);
            return {
                originalName: name,
                normalizedName,
                confidence,
                possibleDuplicates: similarNames
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during name deduplication';
            this.logger.error(formatErrorMessage({
                message: 'Error deduplicating name',
                details: errorMessage
            }));
            throw new DataNormalizationError(errorMessage, error instanceof Error ? error : undefined);
        }
    }
    async cleanData(data, rules = {}, depth = 0, seen = new Set()) {
        try {
            if (depth > 100) {
                throw new DataNormalizationError('Maximum object depth exceeded');
            }
            if (seen.has(data)) {
                throw new DataNormalizationError('Circular reference detected');
            }
            seen.add(data);
            const cleaned = {};
            for (const [key, value] of Object.entries(data)) {
                if (value === null || value === undefined) {
                    cleaned[key] = value;
                }
                else if (typeof value === 'string') {
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
                }
                else if (Array.isArray(value)) {
                    const cleanedArray = await Promise.all(value.map(async (item) => {
                        if (isCleanableObject(item)) {
                            return this.cleanData(item, rules, depth + 1, seen);
                        }
                        return item;
                    }));
                    cleaned[key] = cleanedArray;
                }
                else if (isCleanableObject(value)) {
                    cleaned[key] = await this.cleanData(value, rules, depth + 1, seen);
                }
                else if (typeof value === 'number' || typeof value === 'boolean') {
                    cleaned[key] = value;
                }
            }
            seen.delete(data);
            return cleaned;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error during data cleaning';
            this.logger.error(formatErrorMessage({
                message: 'Error cleaning data',
                details: errorMessage
            }));
            throw new DataNormalizationError(errorMessage, error instanceof Error ? error : undefined);
        }
    }
    parseAddressComponents(address) {
        const parts = address.split(',').map(p => p.trim());
        return {
            street: parts[0] || '',
            city: parts[1] || '',
            state: (parts[2] || '').split(' ')[0] || '',
            zipCode: (parts[2] || '').split(' ')[1] || '',
            country: parts[3]
        };
    }
    standardizeStreet(street) {
        if (!street.trim())
            return '';
        return StringUtils.standardizeAbbreviations(street.trim());
    }
    standardizeCity(city) {
        if (!city.trim())
            return '';
        return city
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/\b\w/g, (m) => m.toUpperCase());
    }
    standardizeState(state) {
        const normalized = state.toLowerCase().trim();
        return stateMappings[normalized] || state.toUpperCase();
    }
    standardizeZipCode(zipCode) {
        const cleaned = zipCode.replace(/\D/g, '');
        if (!cleaned)
            return '';
        return cleaned.length > 5 ? `${cleaned.slice(0, 5)}-${cleaned.slice(5)}` : cleaned;
    }
    standardizeCountry(country) {
        return countryMappings[country.toLowerCase().trim()] || country.toUpperCase();
    }
    normalizeNameString(name) {
        return name
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    calculateNameMatchConfidence(normalizedName, exactMatches, similarMatches) {
        if (exactMatches.length > 0)
            return 1.0;
        if (similarMatches.length === 0)
            return 0.0;
        const totalSimilarity = similarMatches.reduce((sum, match) => {
            return sum + StringUtils.calculateStringSimilarity(normalizedName, match);
        }, 0);
        return totalSimilarity / similarMatches.length;
    }
}
//# sourceMappingURL=DataNormalizer.js.map