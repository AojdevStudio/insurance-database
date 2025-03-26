# API Security Documentation

## Overview
This document outlines the security measures implemented in the Insurance Database API.

## Authentication
The API uses API key-based authentication. All requests must include an API key in the `X-API-Key` header.

### API Key Management
- Keys are created with specific permissions and rate limits
- Keys can be rotated and revoked
- Keys automatically expire after a configured duration
- Key usage is monitored and audited

### API Key Format
```
X-API-Key: your-api-key
```

## Rate Limiting
Rate limits are enforced per API key and can be configured with:
- Requests per minute
- Requests per hour
- Requests per day

### Rate Limit Headers
The following headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests allowed in the current window
- `X-RateLimit-Remaining`: Remaining requests in the current window
- `X-RateLimit-Reset`: Timestamp when the rate limit resets

## Security Headers
The API implements various security headers using Helmet:

### Content Security Policy (CSP)
- Default source: self only
- Scripts: self and unsafe-inline
- Styles: self and unsafe-inline
- Images: self, data, and HTTPS
- Frames: none
- Objects: none

### Additional Security Headers
- Cross-Origin Embedder Policy: require-corp
- Cross-Origin Opener Policy: same-origin
- Cross-Origin Resource Policy: same-origin
- DNS Prefetch Control: off
- Frame Guard: deny
- HSTS: max-age=31536000; includeSubDomains; preload
- IE No Open: enabled
- No Sniff: enabled
- Permitted Cross-Domain Policies: none
- Referrer Policy: strict-origin-when-cross-origin
- XSS Filter: enabled

## CORS Configuration
Cross-Origin Resource Sharing is configured with:
- Origins: Configurable via ALLOWED_ORIGINS environment variable
- Methods: GET, POST, PUT, DELETE, OPTIONS
- Allowed Headers: Content-Type, Authorization, X-API-Key
- Exposed Headers: Rate limit headers, request ID, response time
- Credentials: Supported
- Max Age: 24 hours

## Request Tracking
Each request is assigned a unique ID and includes:
- `X-Request-ID` header in responses
- `X-Response-Time` header showing processing time
- Comprehensive request logging
- Performance monitoring

## Audit Logging
All API requests are logged with:
- Request ID
- API key ID
- Endpoint
- Method
- Response status
- Client IP
- User agent
- Request duration

## Error Handling
- Authentication errors (401)
- Rate limit exceeded (429)
- Permission denied (403)
- Not found (404)
- Validation errors (400)
- Server errors (500)

## Environment Variables
Required environment variables:
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `ALLOWED_ORIGINS`: Comma-separated list of allowed origins for CORS

## Best Practices
1. Rotate API keys regularly
2. Monitor API usage patterns
3. Review audit logs periodically
4. Keep dependencies updated
5. Use HTTPS only
6. Implement proper error handling
7. Follow security alerts

## Security Monitoring
The API includes built-in security monitoring:
- Request rate monitoring
- Error rate tracking
- Performance metrics
- Security alerts
- Usage analytics

## Incident Response
In case of security incidents:
1. API keys can be immediately revoked
2. Rate limits can be adjusted
3. Origins can be blocked
4. Audit logs can be reviewed
5. Alerts are generated 