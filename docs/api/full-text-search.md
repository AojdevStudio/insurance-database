# Full-Text Search API

This document describes the full-text search functionality implemented in the Insurance Database API.

## Overview

The full-text search API provides advanced text search capabilities for guidelines, leveraging PostgreSQL's built-in full-text search features. It offers:

- Relevance ranking of search results
- Text highlighting of matched terms
- Filtering by carrier and category
- Pagination of results

## API Endpoint

```
GET /api/fuzzy-search/full-text
```

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| query | string | Yes | - | The search query text |
| limit | number | No | 10 | Maximum number of results to return |
| offset | number | No | 0 | Number of results to skip (for pagination) |
| carrierId | number | No | - | Filter results by carrier ID |
| category | string | No | - | Filter results by category |
| includeHighlights | boolean | No | true | Include highlighted text snippets in the response |
| minRank | number | No | 0.01 | Minimum rank threshold for results |

### Response Format

```json
{
  "success": true,
  "results": [
    {
      "item": {
        "id": 1,
        "title": "Root Canal Guidelines",
        "content": "Detailed guidelines for root canal procedures...",
        "category": "Endodontics",
        "carrierId": 101,
        "carrierName": "Delta Dental"
      },
      "rank": 0.75,
      "highlights": [
        "<b>Root</b> Canal Guidelines",
        "Detailed guidelines for <b>root</b> canal procedures..."
      ]
    }
  ],
  "count": 1
}
```

## Implementation Details

### PostgreSQL Full-Text Search

The implementation uses PostgreSQL's full-text search capabilities:

- `to_tsvector` - Converts text to a searchable vector
- `to_tsquery` - Converts a query string to a query object
- `@@` - Text search operator
- `ts_rank` - Ranks results by relevance
- `ts_headline` - Generates highlighted snippets

### Database Optimizations

For optimal performance, the following database optimizations are in place:

- GIN index on the full-text search vector: `CREATE INDEX idx_guidelines_fulltext ON guidelines USING GIN (to_tsvector('english', title || ' ' || content))`
- Database function for efficient search: `fulltext_search(query_text, similarity_threshold, max_results, offset_value, filter_carrier_id, filter_category)`

### Prisma Integration

The full-text search is implemented using Prisma's `$queryRaw` functionality, which allows executing raw SQL queries while maintaining type safety and parameterization.

## Example Usage

### Basic Search

```
GET /api/fuzzy-search/full-text?query=root%20canal
```

### Filtered Search

```
GET /api/fuzzy-search/full-text?query=implant&carrierId=102&category=Implants
```

### Paginated Search

```
GET /api/fuzzy-search/full-text?query=dental&limit=10&offset=20
```

## Error Handling

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Missing required query parameter |
| 500 | Server error during search |

## Performance Considerations

- The full-text search is optimized with database indexes
- For large result sets, use pagination (limit and offset parameters)
- The `minRank` parameter can be adjusted to filter out low-relevance results
- The `includeHighlights` parameter can be set to `false` to reduce response size if highlights are not needed
