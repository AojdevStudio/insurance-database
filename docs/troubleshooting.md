# Troubleshooting Guide

This guide covers common issues you might encounter when using the Insurance Database API and provides solutions for resolving them.

## Table of Contents
1. [Authentication Issues](#authentication-issues)
2. [Rate Limiting](#rate-limiting)
3. [Search Issues](#search-issues)
4. [Performance Issues](#performance-issues)
5. [Common Error Codes](#common-error-codes)

## Authentication Issues

### Invalid API Key
**Problem**: Requests return a 401 Unauthorized error.

**Solution**:
1. Verify your API key is correct and not expired
2. Check that the API key is being sent in the `X-API-Key` header
3. Ensure the API key has the necessary permissions
4. Try regenerating your API key if the issue persists

### Missing API Key
**Problem**: Requests return a 401 Unauthorized error with "Missing API key" message.

**Solution**:
1. Add the `X-API-Key` header to your requests
2. Check your code for typos in the header name
3. Verify the API key is being set correctly in your client configuration

## Rate Limiting

### Rate Limit Exceeded
**Problem**: Requests return a 429 Too Many Requests error.

**Solution**:
1. Check your current rate limits in the response headers:
   - `X-RateLimit-Limit`: Total requests allowed per window
   - `X-RateLimit-Remaining`: Remaining requests in current window
   - `X-RateLimit-Reset`: Time when the rate limit resets
2. Implement rate limit handling using the examples in the code examples document
3. Consider implementing caching for frequently accessed data
4. If you consistently hit rate limits, contact support about increasing your limits

### Semantic Search Rate Limits
**Problem**: Semantic search requests are being rate limited more aggressively.

**Solution**:
1. Use text search when exact matches are sufficient
2. Cache semantic search results for similar queries
3. Implement hybrid search with appropriate weights to balance performance
4. Batch similar queries together to minimize API calls

## Search Issues

### Poor Search Results

**Problem**: Search results are not returning expected guidelines.

**Solution**:
1. Text Search Issues:
   - Check for typos in the search query
   - Try using different keywords or synonyms
   - Use partial words or phrases instead of exact matches
   - Verify the search query isn't too specific

2. Semantic Search Issues:
   - Ensure the query is descriptive enough (2-3 sentences recommended)
   - Try rephrasing the query to be more specific
   - Adjust the `min_similarity` threshold (default: 0.7)
   - Check if the content you're looking for is actually in the database

3. Hybrid Search Issues:
   - Adjust `text_weight` and `vector_weight` based on your needs
   - Try different combinations of weights (e.g., 0.3/0.7, 0.5/0.5)
   - Consider using RRF hybrid search for better results

### Empty Search Results

**Problem**: Search returns no results when results are expected.

**Solution**:
1. Verify the search query isn't too restrictive
2. Lower the `min_similarity` threshold for semantic search
3. Try different search types (text, semantic, hybrid)
4. Check if the carrier_id filter is correct (if used)
5. Verify the data exists in the database

## Performance Issues

### Slow Response Times

**Problem**: API requests are taking longer than expected.

**Solution**:
1. General Optimization:
   - Implement client-side caching
   - Reduce request frequency where possible
   - Use pagination to limit response size
   - Only request needed fields

2. Search Optimization:
   - Use text search for simple queries
   - Cache semantic search results
   - Implement hybrid search with appropriate weights
   - Use pagination and limit results

3. Network Issues:
   - Check your network connection
   - Verify DNS resolution
   - Consider using a CDN if available
   - Monitor request/response times

### High Memory Usage

**Problem**: Client application using excessive memory.

**Solution**:
1. Implement proper pagination
2. Clear unused cache entries
3. Process large result sets in chunks
4. Release references to response data when no longer needed

## Common Error Codes

### 400 Bad Request
- Invalid request parameters
- Missing required fields
- Invalid search type
- Invalid carrier ID
- Malformed JSON body

**Solution**: Verify request parameters match the API specification

### 401 Unauthorized
- Missing API key
- Invalid API key
- Expired API key

**Solution**: Check authentication setup and API key validity

### 403 Forbidden
- Insufficient permissions
- Rate limit exceeded
- IP address blocked

**Solution**: Verify account permissions and rate limit status

### 404 Not Found
- Invalid endpoint
- Resource not found
- Invalid carrier ID
- Invalid guideline ID

**Solution**: Check resource IDs and endpoint URLs

### 429 Too Many Requests
- Rate limit exceeded
- Too many semantic search requests
- Too many concurrent requests

**Solution**: Implement rate limit handling and backoff strategies

### 500 Internal Server Error
- Server-side error
- Database error
- Search service error

**Solution**: 
1. Retry the request after a delay
2. Contact support if the issue persists
3. Check status page for service updates

### 503 Service Unavailable
- Server maintenance
- Service overload
- Temporary outage

**Solution**:
1. Implement retry logic with exponential backoff
2. Check service status
3. Try again later 