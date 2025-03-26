# Network Mapping Rules

## Overview
This document outlines the rules and processes for mapping insurance carriers to networks in the insurance database system.

## Network Detection

### Automatic Network Detection
Networks are automatically detected using the following patterns:
1. Keywords in carrier names:
   - "network"
   - "alliance"
   - "association"
   - "group"
   - "ppo"
   - "hmo"

2. Website domain analysis:
   - Domains containing network-related keywords
   - Shared domains between multiple carriers

### Network Relationships

#### Creation Rules
1. Each carrier can belong to multiple networks
2. Network relationships must have:
   - Valid network ID
   - Valid carrier ID
   - Optional effective date
   - Optional termination date (must be after effective date)
   - Optional special notes
   - Verification flag

#### Validation Rules
1. Date Range Validation:
   - Effective date must be before termination date
   - Future effective dates are allowed
   - Past termination dates are allowed

2. Relationship Validation:
   - No duplicate relationships between same network and carrier
   - All carriers should have at least one network relationship
   - Networks should have at least one carrier

## Reporting

### Network Mapping Report
The system generates reports containing:
1. Total number of networks
2. Total number of relationships
3. Number of unmapped carriers
4. Validation errors:
   - Invalid date ranges
   - Unmapped carriers
   - Other relationship issues

### Error Handling
1. Database Errors:
   - All database operations are wrapped in try-catch blocks
   - Errors are logged with detailed context
   - Operations fail gracefully with clear error messages

2. Validation Errors:
   - Invalid relationships are reported but don't block operation
   - Missing relationships are flagged for review
   - Date range issues are highlighted for correction

## Best Practices

1. Network Creation:
   - Use standardized naming conventions
   - Include complete contact information
   - Document special requirements or notes

2. Relationship Management:
   - Regular validation of relationships
   - Prompt correction of validation errors
   - Regular review of unmapped carriers

3. Data Quality:
   - Verify network information before creation
   - Keep relationship dates current
   - Document special cases in notes

## Implementation Notes

1. Database Structure:
   - Networks table contains core network information
   - Relationships table manages carrier-network associations
   - Indexes optimize query performance

2. Performance Considerations:
   - Batch processing for large datasets
   - Optimized queries for relationship validation
   - Efficient report generation

3. Maintenance:
   - Regular validation runs
   - Automated report generation
   - Periodic review of mapping rules 