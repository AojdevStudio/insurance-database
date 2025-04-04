# Procedure Code Search API

This document describes the procedure code search functionality implemented in the Insurance Database API.

## Overview

The procedure code search API provides specialized search capabilities for dental procedure codes, supporting multiple search strategies:

- Exact matching
- Prefix matching
- Suffix matching
- Contains matching
- Fuzzy matching

It also supports filtering by category and including procedure requirements in the results.

## API Endpoint

```
GET /api/fuzzy-search/procedures/code
```

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| code | string | Yes | - | The procedure code to search for |
| searchType | string | No | 'contains' | Search strategy: 'exact', 'prefix', 'suffix', 'contains', or 'fuzzy' |
| limit | number | No | 10 | Maximum number of results to return |
| offset | number | No | 0 | Number of results to skip (for pagination) |
| category | string | No | - | Filter results by procedure category |
| includeRequirements | boolean | No | false | Include procedure requirements in the response |
| minScore | number | No | 0.3 | Minimum similarity score (for fuzzy search) |

### Response Format

```json
{
  "success": true,
  "results": [
    {
      "item": {
        "id": 1,
        "procedureCode": "D0120",
        "description": "Periodic oral evaluation",
        "category": "Diagnostic",
        "requirements": [
          {
            "id": 101,
            "requirementType": "X-Ray",
            "description": "Requires periapical X-rays",
            "carrierId": 1,
            "carrierName": "Delta Dental"
          }
        ]
      },
      "matchType": "exact",
      "score": 1.0
    }
  ],
  "count": 1,
  "searchType": "exact"
}
```

## Search Strategies

### Exact Match

Finds procedures with codes that exactly match the search term.

```
GET /api/fuzzy-search/procedures/code?code=D0120&searchType=exact
```

### Prefix Match

Finds procedures with codes that start with the search term.

```
GET /api/fuzzy-search/procedures/code?code=D01&searchType=prefix
```

### Suffix Match

Finds procedures with codes that end with the search term.

```
GET /api/fuzzy-search/procedures/code?code=20&searchType=suffix
```

### Contains Match (Default)

Finds procedures with codes that contain the search term anywhere.

```
GET /api/fuzzy-search/procedures/code?code=12
```

### Fuzzy Match

Finds procedures with codes that are similar to the search term, using trigram similarity.

```
GET /api/fuzzy-search/procedures/code?code=D0120&searchType=fuzzy&minScore=0.5
```

## Implementation Details

### Database Optimizations

For optimal performance, the following database optimizations are in place:

- B-tree index on procedure code: `CREATE INDEX idx_procedure_code ON procedure (procedure_code)`
- B-tree index on procedure category: `CREATE INDEX idx_procedure_category ON procedure (category)`
- GIN trigram index for fuzzy search: `CREATE INDEX idx_procedure_code_trgm ON procedure USING GIN (procedure_code gin_trgm_ops)`
- Database function for efficient search: `procedure_code_search(code_pattern, search_type, min_score, max_results, offset_value, filter_category)`

### Prisma Integration

The procedure code search is implemented using a combination of:

- Prisma's `$queryRaw` for efficient SQL execution with proper parameterization
- Prisma's ORM features for fetching related data (procedure requirements)

## Example Usage

### Basic Search (Contains)

```
GET /api/fuzzy-search/procedures/code?code=120
```

### Prefix Search with Category Filter

```
GET /api/fuzzy-search/procedures/code?code=D01&searchType=prefix&category=Diagnostic
```

### Fuzzy Search with Requirements

```
GET /api/fuzzy-search/procedures/code?code=D0120&searchType=fuzzy&includeRequirements=true
```

## Error Handling

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Missing required code parameter or invalid search type |
| 500 | Server error during search |

## Performance Considerations

- For large result sets, use pagination (limit and offset parameters)
- The `exact` and `prefix` search types are the most efficient
- The `fuzzy` search type is the least efficient but provides the most flexible matching
- Use the `category` parameter to narrow down results when possible
- Only set `includeRequirements` to `true` when the requirements data is needed, as it requires additional database queries
