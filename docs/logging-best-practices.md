# Logging Best Practices

## Log Levels

### Debug
- Use for detailed information during development
- Include variable values, state changes, and flow control
- Example: `logger.debug('Processing user data', { userId, action })`

### Info
- Use for tracking normal application flow
- Record successful operations and important state changes
- Example: `logger.info('User registration complete', { userId })`

### Warn
- Use for unexpected but recoverable situations
- Indicate potential issues that don't stop execution
- Example: `logger.warn('Rate limit approaching', { currentRate, limit })`

### Error
- Use for unrecoverable errors and exceptions
- Include stack traces and relevant context
- Example: `logger.error('Database connection failed', { error, retryCount })`

## Best Practices

1. **Structured Logging**
   - Always use structured log format
   - Include relevant context objects
   - Use consistent field names

2. **Performance Considerations**
   - Avoid logging in tight loops
   - Use appropriate log levels
   - Consider log rotation and retention

3. **Security**
   - Never log sensitive information
   - Mask PII and credentials
   - Follow compliance requirements

4. **Context**
   - Include request IDs for tracing
   - Add timestamp and environment
   - Provide relevant business context

5. **Error Handling**
   - Log all error details
   - Include stack traces
   - Add recovery actions taken

## Implementation Examples

```typescript
// Good - Structured logging with context
logger.info('User action completed', {
  userId: user.id,
  action: 'update',
  status: 'success'
});

// Good - Error logging with details
logger.error('Operation failed', {
  error: err.message,
  stack: err.stack,
  context: {
    operation: 'dataSync',
    attempt: retryCount
  }
});

// Bad - Unstructured logging
logger.info('User ' + userId + ' did something');

// Bad - Missing context
logger.error('Failed to process');
```

## Testing Guidelines

1. **Coverage**
   - Test all log levels
   - Verify error handling
   - Check context objects
   - Validate structured format

2. **Mocking**
   - Use MockPostgrestResponse
   - Test database failures
   - Verify retry logic

3. **Performance**
   - Test under load
   - Verify async handling
   - Check memory usage 