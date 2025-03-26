# Code Examples

This document provides code examples for common API operations in various programming languages.

## Table of Contents
1. [Authentication](#authentication)
2. [Basic Operations](#basic-operations)
3. [Search Operations](#search-operations)
4. [Error Handling](#error-handling)
5. [Rate Limit Handling](#rate-limit-handling)

## Authentication

### JavaScript/TypeScript
```typescript
const API_KEY = 'your-api-key';

const client = axios.create({
  baseURL: '/api',
  headers: {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  }
});
```

### Python
```python
import requests

API_KEY = 'your-api-key'

session = requests.Session()
session.headers.update({
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
})
```

## Basic Operations

### List Carriers

#### JavaScript/TypeScript
```typescript
async function listCarriers(page = 1, limit = 20) {
  try {
    const response = await client.get('/carriers', {
      params: { page, limit }
    });
    return response.data;
  } catch (error) {
    handleError(error);
  }
}
```

#### Python
```python
def list_carriers(page=1, limit=20):
    try:
        response = session.get('/api/carriers', params={
            'page': page,
            'limit': limit
        })
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        handle_error(e)
```

### Get Carrier by ID

#### JavaScript/TypeScript
```typescript
async function getCarrier(id: number) {
  try {
    const response = await client.get(`/carriers/${id}`);
    return response.data;
  } catch (error) {
    handleError(error);
  }
}
```

#### Python
```python
def get_carrier(carrier_id):
    try:
        response = session.get(f'/api/carriers/{carrier_id}')
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        handle_error(e)
```

## Search Operations

### Text Search

#### JavaScript/TypeScript
```typescript
async function searchGuidelines(query: string, options = {}) {
  try {
    const response = await client.get('/guidelines/search', {
      params: {
        query,
        search_type: 'text',
        ...options
      }
    });
    return response.data;
  } catch (error) {
    handleError(error);
  }
}
```

#### Python
```python
def search_guidelines(query, **options):
    try:
        params = {
            'query': query,
            'search_type': 'text',
            **options
        }
        response = session.get('/api/guidelines/search', params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        handle_error(e)
```

### Semantic Search

#### JavaScript/TypeScript
```typescript
async function semanticSearch(query: string, options = {}) {
  try {
    const response = await client.get('/guidelines/search', {
      params: {
        query,
        search_type: 'semantic',
        min_similarity: 0.7,
        ...options
      }
    });
    return response.data;
  } catch (error) {
    handleError(error);
  }
}
```

#### Python
```python
def semantic_search(query, **options):
    try:
        params = {
            'query': query,
            'search_type': 'semantic',
            'min_similarity': 0.7,
            **options
        }
        response = session.get('/api/guidelines/search', params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        handle_error(e)
```

### Hybrid Search

#### JavaScript/TypeScript
```typescript
async function hybridSearch(query: string, options = {}) {
  try {
    const response = await client.get('/guidelines/search', {
      params: {
        query,
        search_type: 'hybrid',
        text_weight: 0.3,
        vector_weight: 0.7,
        ...options
      }
    });
    return response.data;
  } catch (error) {
    handleError(error);
  }
}
```

#### Python
```python
def hybrid_search(query, **options):
    try:
        params = {
            'query': query,
            'search_type': 'hybrid',
            'text_weight': 0.3,
            'vector_weight': 0.7,
            **options
        }
        response = session.get('/api/guidelines/search', params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        handle_error(e)
```

## Error Handling

### JavaScript/TypeScript
```typescript
function handleError(error: any) {
  if (error.response) {
    // API error response
    const { status, data } = error.response;
    switch (status) {
      case 400:
        console.error('Validation error:', data.error);
        break;
      case 401:
        console.error('Authentication error:', data.error);
        break;
      case 429:
        handleRateLimit(error.response);
        break;
      default:
        console.error('API error:', data.error);
    }
  } else if (error.request) {
    // Network error
    console.error('Network error:', error.message);
  } else {
    console.error('Error:', error.message);
  }
  throw error;
}
```

### Python
```python
def handle_error(error):
    if isinstance(error, requests.exceptions.HTTPError):
        status = error.response.status_code
        data = error.response.json()
        
        if status == 400:
            logger.error('Validation error: %s', data['error'])
        elif status == 401:
            logger.error('Authentication error: %s', data['error'])
        elif status == 429:
            handle_rate_limit(error.response)
        else:
            logger.error('API error: %s', data['error'])
    elif isinstance(error, requests.exceptions.RequestException):
        logger.error('Network error: %s', str(error))
    else:
        logger.error('Error: %s', str(error))
    raise error
```

## Rate Limit Handling

### JavaScript/TypeScript
```typescript
class RateLimitHandler {
  private retryAfter: number = 0;
  private maxRetries: number = 3;
  private baseDelay: number = 1000;

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    retryCount = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error.response?.status === 429 &&
        retryCount < this.maxRetries
      ) {
        const delay = this.calculateDelay(error.response, retryCount);
        await this.wait(delay);
        return this.executeWithRetry(operation, retryCount + 1);
      }
      throw error;
    }
  }

  private calculateDelay(response: any, retryCount: number): number {
    const resetTime = response.headers['x-ratelimit-reset'];
    if (resetTime) {
      return Math.max(
        0,
        new Date(parseInt(resetTime)).getTime() - Date.now()
      );
    }
    return Math.min(
      this.baseDelay * Math.pow(2, retryCount),
      60000 // Max 1 minute
    );
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const rateLimitHandler = new RateLimitHandler();
const result = await rateLimitHandler.executeWithRetry(() =>
  client.get('/guidelines/search', { params })
);
```

### Python
```python
import time
from typing import TypeVar, Callable
from functools import wraps

T = TypeVar('T')

class RateLimitHandler:
    def __init__(self):
        self.max_retries = 3
        self.base_delay = 1.0  # seconds

    def with_retry(self, operation: Callable[[], T]) -> T:
        @wraps(operation)
        def wrapper(*args, **kwargs):
            for retry in range(self.max_retries):
                try:
                    return operation(*args, **kwargs)
                except requests.exceptions.HTTPError as e:
                    if e.response.status_code == 429:
                        if retry == self.max_retries - 1:
                            raise
                        delay = self._calculate_delay(e.response, retry)
                        time.sleep(delay)
                        continue
                    raise
            return operation(*args, **kwargs)
        return wrapper

    def _calculate_delay(self, response, retry):
        reset_time = response.headers.get('x-ratelimit-reset')
        if reset_time:
            return max(
                0,
                float(reset_time) - time.time()
            )
        return min(
            self.base_delay * (2 ** retry),
            60.0  # Max 1 minute
        )

# Usage
rate_limit_handler = RateLimitHandler()

@rate_limit_handler.with_retry
def search_with_retry(**params):
    return session.get('/api/guidelines/search', params=params).json() 