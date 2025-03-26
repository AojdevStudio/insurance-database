

## Key Data Points for Dental Insurance Agent

### 1. Network-Carrier Hierarchy Information
- Complete network mappings (which carriers belong to which networks)
- Parent-child relationships between carriers and their subsidiaries
- Network participation effective dates and termination dates
- Special relationship notes (e.g., Aetna no longer adding providers to Zelis as of 9-2022)

### 2. Credentialing Requirements
- Required documentation for each network/carrier
- Application processes specific to each network
- Timeframes for application processing
- Renewal requirements and frequencies
- State-specific requirements (e.g., for Medicare Advantage)

### 3. Contract Terms and Provisions
- Fee schedule information and negotiation points
- Amendment processes and notifications
- Termination clauses and requirements
- Assignment clauses (can the contract be transferred)
- Exclusivity provisions

### 4. Claims Processing Information
- Payer IDs for electronic submissions
- Claims mailing addresses
- Claims appeal processes and timeframes
- Required documentation for specific procedures
- Timely filing limits

### 5. Coverage Verification
- Contact information for eligibility verification
- Required information for verification calls
- Common verification pitfalls by carrier
- Coverage limitation verification protocols

### 6. Plan-Specific Details
- Distinction between commercial, Medicare Advantage, and other plan types
- State-specific plan variations
- Special handling for FEP/FEDVIP plans
- Handling of plans with unusual coverage patterns

### 7. Procedure-Specific Requirements
- Frequency limitations by procedure code
- Documentation requirements by procedure
- Pre-authorization requirements
- Bundling/unbundling rules by carrier

### 8. Critical Caveats and Special Cases
- Exceptions to standard processes by carrier
- Known issues with specific networks or carriers
- Workarounds for common problems
- "Gotchas" in the credentialing or claims process

### 9. Relationship Management
- Provider relations contact information
- Escalation paths for issues
- Network representative information
- Contract negotiation contact points

### 10. Search and Identification Support
- Carrier alternative names and aliases
- Parent company relationships
- Acquisition history of carriers
- Brand variations by region/state

## Recommended Implementation Approach

1. **Primary Database Tables**: Implement the schema I outlined earlier, with special focus on:
   - Network-carrier relationships
   - Carrier aliases and similar names
   - Processing caveats and exceptions

2. **Vector Search Capability**: Implement semantic search for guidelines and requirements to handle questions like "What documentation is needed for crown procedures with Cigna?"

3. **Hierarchy Traversal Functions**: Create database functions that can traverse the network-carrier hierarchy to answer questions like "Is BCBS of Texas part of DNOA network?"

4. **Temporal Data Handling**: Store effective dates and termination dates for all relationships to handle historical queries and changes in network participation.

5. **Fuzzy Matching for Carriers**: Implement fuzzy search for carrier names to handle variations and misspellings.

6. **Contextual Recommendation Engine**: Create a system that can provide contextual advice based on practice location, specialty, and target carriers.

## Agent Narrative Capabilities

With these data points, your agent should be able to construct narratives such as:

1. **Credentialing Guidance**: "To credential with Cigna, you'll need to submit XYZ forms. Since Cigna is part of the Zelis network, your credentialing will also give you access to these other carriers. Be aware that Cigna typically takes 90-120 days to process applications, and there's a critical requirement to include your most recent tax ID documentation."

2. **Claims Processing Advice**: "For this crown procedure with MetLife PDP+, you'll need to submit periapical radiographs showing the condition before treatment. MetLife has a specific requirement that these images must be dated within 6 months of treatment. Your claim should be submitted to payer ID 12345."

3. **Network Participation Strategies**: "Based on your practice location in Houston, participation in these three networks would give you optimal coverage of the local insurance market. Start with Connection Dental as it provides access to the largest number of carriers in your area."

These capabilities would make your dental insurance agent a powerful tool for dental practices navigating the complex world of insurance credentialing and claims management.

