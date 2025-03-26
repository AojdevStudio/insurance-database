# Insurance Database API Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Authentication](#authentication)
3. [Rate Limiting](#rate-limiting)
4. [Common Patterns](#common-patterns)
5. [Error Handling](#error-handling)
6. [Best Practices](#best-practices)

## Introduction

The Insurance Database API provides comprehensive access to insurance carrier information, procedures, and guidelines. The API supports various search methods, including text-based, semantic, and hybrid search capabilities.

### Base URL
```
/api
```

### Response Format
All responses are in JSON format and follow a consistent structure:
- Success responses include the requested data
- Error responses include error details and status codes
- Paginated responses include metadata about the total count and pages

## Authentication

### API Key Authentication
All requests must include an API key in the `X-API-Key` header:

```http
X-API-Key: your-api-key
```

### Obtaining an API Key
Contact the API administrator to obtain an API key. Each key has specific:
- Rate limits
- Endpoint permissions
- Usage quotas

### Key Security
- Never expose your API key in client-side code
- Rotate keys periodically
- Use different keys for development and production

## Rate Limiting

### Default Limits
- Regular endpoints: 100 requests per 15 minutes
- Semantic search: 50 requests per 15 minutes
- Hybrid search: 50 requests per 15 minutes

### Rate Limit Headers
Each response includes rate limit information:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1616876400000
```

### Handling Rate Limits
- Monitor rate limit headers
- Implement exponential backoff
- Cache frequently accessed data
- Use bulk operations where possible

## Common Patterns

### Pagination
Most list endpoints support pagination:
```http
GET /api/carriers?page=1&limit=20
```

Parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

### Sorting
```http
GET /api/carriers?sort_by=name&sort_order=asc
```

Parameters:
- `sort_by`: Field to sort by
- `sort_order`: 'asc' or 'desc'

### Filtering
```http
GET /api/procedures?category=surgery
GET /api/guidelines?carrier_id=123
```

### Search Types

1. **Text Search**
```http
GET /api/guidelines/search?query=diabetes&search_type=text
```

2. **Semantic Search**
```http
GET /api/guidelines/search?query=diabetes&search_type=semantic
```

3. **Hybrid Search**
```http
GET /api/guidelines/search?query=diabetes&search_type=hybrid&text_weight=0.3&vector_weight=0.7
```

4. **RRF Hybrid Search**
```http
GET /api/guidelines/search?query=diabetes&search_type=rrf_hybrid&rrf_k=60
```

## Error Handling

### Error Response Format
```json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {
      "field": ["Error details"]
    }
  }
}
```

### Common Error Codes
- `VALIDATION_ERROR`: Invalid request parameters
- `NOT_FOUND`: Resource not found
- `RATE_LIMIT_ERROR`: Rate limit exceeded
- `AUTHENTICATION_ERROR`: Invalid API key
- `INTERNAL_ERROR`: Server error

### Handling Errors
1. Always check response status codes
2. Implement proper error handling
3. Log errors for debugging
4. Implement retry logic where appropriate

## Best Practices

### Performance
1. Use appropriate search types:
   - Text search for exact matches
   - Semantic search for conceptual matches
   - Hybrid search for balanced results

2. Optimize requests:
   - Use pagination
   - Cache responses
   - Batch requests when possible

### Security
1. Protect API keys
2. Validate input data
3. Handle errors gracefully
4. Monitor API usage

### Caching
1. Cache frequently accessed data
2. Respect cache headers
3. Implement cache invalidation
4. Use conditional requests

### Search Optimization
1. Choose appropriate search type:
   - Text search: Good for exact matches
   - Semantic search: Better for conceptual matches
   - Hybrid search: Best for balanced results
   - RRF hybrid: Best for combining multiple ranking methods

2. Tune search parameters:
   - `min_similarity`: Control result quality
   - `text_weight`/`vector_weight`: Balance hybrid search
   - `rrf_k`: Adjust RRF algorithm behavior

### Rate Limit Management
1. Monitor rate limit headers
2. Implement backoff strategies
3. Cache responses
4. Use bulk operations 