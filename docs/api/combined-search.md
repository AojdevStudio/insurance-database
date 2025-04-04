# Combined Search API

This document describes the combined search functionality implemented in the Insurance Database API.

## Overview

The combined search API provides a unified search experience across multiple entity types:

- Insurance carriers
- Dental procedures
- Clinical guidelines
- Provider networks

It performs parallel searches across these entities and returns consolidated results, allowing users to find relevant information regardless of which entity type it belongs to.

## API Endpoint

```
GET /api/fuzzy-search/combined
```

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| query | string | Yes | - | The search query text |
| limit | number | No | 5 | Maximum number of results per entity type |
| includeCarriers | boolean | No | true | Include carriers in search results |
| includeProcedures | boolean | No | true | Include procedures in search results |
| includeGuidelines | boolean | No | true | Include guidelines in search results |
| includeNetworks | boolean | No | true | Include networks in search results |
| category | string | No | - | Filter results by category where applicable |
| minScore | number | No | 0.3 | Minimum similarity score threshold |

### Response Format

```json
{
  "success": true,
  "results": {
    "carriers": [
      {
        "item": {
          "id": 1,
          "carrierName": "Delta Dental",
          "carrierCode": "DELTA"
        },
        "score": 0.8
      }
    ],
    "procedures": [
      {
        "item": {
          "id": 101,
          "procedureCode": "D0120",
          "description": "Periodic oral evaluation",
          "category": "Diagnostic"
        },
        "matchType": "contains",
        "score": 0.7
      }
    ],
    "guidelines": [
      {
        "item": {
          "id": 201,
          "title": "Root Canal Guidelines",
          "content": "Detailed guidelines for root canal procedures",
          "category": "Endodontics",
          "carrierId": 1,
          "carrierName": "Delta Dental"
        },
        "rank": 0.75,
        "highlights": ["<b>Root</b> Canal Guidelines"]
      }
    ],
    "networks": [
      {
        "item": {
          "id": 301,
          "networkName": "Premier Network",
          "networkCode": "PREMIER"
        },
        "score": 0.6
      }
    ],
    "totalResults": 4
  },
  "totalResults": 4,
  "entityCounts": {
    "carriers": 1,
    "procedures": 1,
    "guidelines": 1,
    "networks": 1
  }
}
```

## Implementation Details

### Search Strategies

The combined search uses different search strategies for each entity type:

- **Carriers**: Fuzzy name matching using PostgreSQL's similarity function
- **Procedures**: 
  - For alphanumeric queries: Contains matching on procedure code
  - For other queries: Fuzzy matching on procedure code and description
- **Guidelines**: Full-text search with ranking and highlighting
- **Networks**: Fuzzy name matching using PostgreSQL's similarity function

### Parallel Execution

The combined search executes all entity searches in parallel using Promise.all(), which provides several benefits:

- Improved performance by executing searches concurrently
- Reduced overall response time
- Graceful handling of errors in individual searches

### Filtering and Scoring

- The `category` parameter filters results by category where applicable (procedures and guidelines)
- The `minScore` parameter sets a minimum threshold for similarity scores across all entity types
- Each entity type has its own scoring mechanism, but all are normalized to a 0-1 scale

## Example Usage

### Basic Search

```
GET /api/fuzzy-search/combined?query=dental
```

### Filtered Search

```
GET /api/fuzzy-search/combined?query=root%20canal&category=Endodontics
```

### Entity-Specific Search

```
GET /api/fuzzy-search/combined?query=D0120&includeCarriers=false&includeGuidelines=false&includeNetworks=false
```

## Error Handling

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Missing required query parameter |
| 500 | Server error during search |

## Performance Considerations

- The combined search is optimized for performance with parallel execution
- For large result sets, use the `limit` parameter to control the number of results per entity
- Use entity inclusion flags to limit searches to only the needed entity types
- The `minScore` parameter can be adjusted to filter out low-relevance results
