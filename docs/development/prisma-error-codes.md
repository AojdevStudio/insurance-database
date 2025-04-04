# Prisma Error Codes Reference

This document provides a comprehensive reference for handling Prisma error codes in the Insurance Database project. Understanding these error codes is essential for implementing proper error handling in your services and controllers.

## Error Types

Prisma has several error classes that you should handle differently:

1. **`PrismaClientKnownRequestError`**: Occurs when the query engine returns a known error related to the request (e.g., unique constraint violations, foreign key constraint failures)

2. **`PrismaClientValidationError`**: Occurs when validation fails, such as when required arguments are missing or of invalid types

3. **`PrismaClientRustPanicError`**: Occurs when the underlying Rust implementation panics (rare, but severe)

4. **`PrismaClientInitializationError`**: Occurs when the Prisma Client fails to initialize (e.g., cannot connect to database)

5. **`PrismaClientUnknownRequestError`**: Occurs when the query engine returns an unknown error

## Common Error Codes

### P2000 - P2999: Query Engine Errors

#### Constraint Violations

| Code | Description | HTTP Status | Handling Strategy |
|------|-------------|-------------|-------------------|
| `P2002` | **Unique constraint violation** | 409 Conflict | Check which field caused the violation (`error.meta?.target`) and provide a specific error message. |
| `P2003` | **Foreign key constraint violation** | 409 Conflict | Inform the user that the referenced record doesn't exist. |
| `P2004` | **Constraint violation** | 400 Bad Request | Generic constraint violation (not unique or foreign key). |

#### Value Errors

| Code | Description | HTTP Status | Handling Strategy |
|------|-------------|-------------|-------------------|
| `P2005` | **Invalid value for field type** | 400 Bad Request | Inform the user about the invalid value type. |
| `P2006` | **Invalid value provided** | 400 Bad Request | The provided value doesn't match the expected type. |
| `P2007` | **Validation error** | 400 Bad Request | General validation error from the query engine. |
| `P2011` | **Null constraint violation** | 400 Bad Request | Attempted to set a non-nullable field to null. |
| `P2012` | **Missing required field** | 400 Bad Request | A required field was not provided. |
| `P2013` | **Missing required argument** | 400 Bad Request | A required argument was not provided. |

#### Record Not Found

| Code | Description | HTTP Status | Handling Strategy |
|------|-------------|-------------|-------------------|
| `P2001` | **Record search failed - not found** | 404 Not Found | No record was found matching the criteria. |
| `P2015` | **Related record not found** | 404 Not Found | A related record was not found. |
| `P2018` | **Required connected records not found** | 404 Not Found | Connected records required for the operation were not found. |
| `P2025` | **Record not found** | 404 Not Found | Attempted to operate on a record that doesn't exist. |

#### Schema-Related Errors

| Code | Description | HTTP Status | Handling Strategy |
|------|-------------|-------------|-------------------|
| `P2008` | **Failed query parsing** | 500 Internal Server Error | Incorrect query syntax or structure. |
| `P2009` | **Failed query validation** | 500 Internal Server Error | Query validation failed. |
| `P2010` | **Raw query failed** | 500 Internal Server Error | A raw query execution failed. |
| `P2014` | **Invalid ID input** | 400 Bad Request | The provided ID is invalid. |
| `P2016` | **Query interpretation error** | 500 Internal Server Error | The query could not be interpreted. |
| `P2019` | **Input error** | 400 Bad Request | General input error. |
| `P2021` | **Table does not exist** | 500 Internal Server Error | Schema sync error - the table doesn't exist. |
| `P2022` | **Column does not exist** | 500 Internal Server Error | Schema sync error - the column doesn't exist. |

#### Connection-Related Errors

| Code | Description | HTTP Status | Handling Strategy |
|------|-------------|-------------|-------------------|
| `P2024` | **Connection failed** | 503 Service Unavailable | Failed to connect to the database. |
| `P2026` | **Unsupported request** | 400 Bad Request | The request is not supported by the query engine. |
| `P2027` | **Multiple errors** | 400 Bad Request | Multiple errors occurred. |
| `P2028` | **Transaction API error** | 500 Internal Server Error | Error in transaction API. |
| `P2029` | **Query not successful** | 500 Internal Server Error | The query failed. |
| `P2030` | **Query engine error** | 500 Internal Server Error | General query engine error. |

## Error Handling Implementation

### Basic Error Handler

Use this pattern to handle Prisma errors in your services:

```typescript
import { Prisma } from '@prisma/client';

try {
  // Prisma operation
  return await prisma.insuranceCarrier.create({ data });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        throw new Error(`A carrier with this ${error.meta?.target as string} already exists`);
      case 'P2025':
        throw new Error('Carrier not found');
      default:
        throw new Error(`Database error: ${error.message}`);
    }
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    throw new Error(`Validation error: ${error.message}`);
  } else {
    throw error; // Rethrow other errors
  }
}
```

### Express Error Middleware for Prisma

This middleware handles Prisma errors and maps them to appropriate HTTP status codes:

```typescript
import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';

export const prismaErrorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Skip if not a Prisma error
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) &&
      !(error instanceof Prisma.PrismaClientValidationError) &&
      !(error instanceof Prisma.PrismaClientRustPanicError) &&
      !(error instanceof Prisma.PrismaClientInitializationError)) {
    return next(error);
  }

  // Handle known request errors with specific codes
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError = error as Prisma.PrismaClientKnownRequestError;
    
    // Map error codes to HTTP status codes
    const statusCodeMap: Record<string, number> = {
      // Not found
      'P2001': 404, 'P2015': 404, 'P2018': 404, 'P2025': 404,
      
      // Conflict
      'P2002': 409, 'P2003': 409, 'P2004': 409,
      
      // Bad request / validation
      'P2005': 400, 'P2006': 400, 'P2007': 400, 
      'P2011': 400, 'P2012': 400, 'P2013': 400,
      'P2014': 400, 'P2019': 400, 'P2026': 400,
      
      // Connection & server errors
      'P2024': 503,
      
      // Default to 500 for other codes
      'default': 500
    };
    
    // Get status code, default to 500
    const statusCode = statusCodeMap[prismaError.code] || 500;
    
    // Create error response
    const errorResponse = {
      error: {
        code: prismaError.code,
        message: getMessageForCode(prismaError.code, prismaError),
        details: prismaError.meta
      }
    };
    
    return res.status(statusCode).json(errorResponse);
  }

  // Handle validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid data provided',
        details: error.message
      }
    });
  }

  // Handle initialization errors
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return res.status(503).json({
      error: {
        code: 'DATABASE_CONNECTION_ERROR',
        message: 'Database connection failed',
        details: error.message
      }
    });
  }

  // Handle Rust panic errors
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return res.status(500).json({
      error: {
        code: 'CRITICAL_DATABASE_ERROR',
        message: 'A critical database error occurred',
        details: error.message
      }
    });
  }

  // Default case
  return next(error);
};

// Helper to get user-friendly messages for error codes
function getMessageForCode(code: string, error: Prisma.PrismaClientKnownRequestError): string {
  switch (code) {
    case 'P2002':
      return `A record with this ${error.meta?.target as string} already exists.`;
    case 'P2003':
      return `The referenced record does not exist.`;
    case 'P2025':
      return `Record not found.`;
    case 'P2011':
      return `Cannot set required field to null.`;
    case 'P2012':
      return `Missing required field.`;
    case 'P2014':
      return `Invalid ID provided.`;
    case 'P2024':
      return `Database connection failed.`;
    default:
      return `Database operation failed: ${error.message}`;
  }
}
```

## Handling Specific Errors by Model

### InsuranceCarrier Errors

```typescript
export class PrismaCarrierErrorHandler {
  static handleError(error: Error): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002':
          const target = error.meta?.target as string[];
          if (target.includes('carrier_name')) {
            return new Error('A carrier with this name already exists');
          }
          if (target.includes('payer_id')) {
            return new Error('A carrier with this payer ID already exists');
          }
          return new Error('This carrier information conflicts with an existing record');
        
        case 'P2025':
          return new Error('Carrier not found');
          
        default:
          return new Error(`Carrier operation failed: ${error.message}`);
      }
    }
    return error;
  }
}
```

### Procedure Errors

```typescript
export class PrismaProcedureErrorHandler {
  static handleError(error: Error): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002':
          const target = error.meta?.target as string[];
          if (target.includes('procedure_code')) {
            return new Error('A procedure with this code already exists');
          }
          return new Error('This procedure information conflicts with an existing record');
        
        case 'P2025':
          return new Error('Procedure not found');
          
        default:
          return new Error(`Procedure operation failed: ${error.message}`);
      }
    }
    return error;
  }
}
```

## Logging and Monitoring

### Prisma Query Logging

```typescript
// In prisma.ts or similar file
const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'stdout',
      level: 'error',
    },
    {
      emit: 'stdout',
      level: 'info',
    },
    {
      emit: 'stdout',
      level: 'warn',
    },
  ],
});

// Log slow queries
prisma.$on('query', (e) => {
  if (e.duration > 500) { // Log queries taking more than 500ms
    console.warn(`Slow query (${e.duration}ms): ${e.query}`);
  }
});
```

### Middleware for Enhanced Logging

```typescript
prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();
  const duration = after - before;
  
  // Log details about the operation
  if (duration > 100) { // Only log slow operations
    console.log(`${params.model}.${params.action} took ${duration}ms`);
    
    // Could also send to monitoring system:
    // metrics.recordDatabaseOperation(params.model, params.action, duration);
  }
  
  return result;
});
```

## Best Practices

### 1. Handle Specific Error Codes

Always handle specific error codes that are relevant to your application's functionality:

```typescript
if (error.code === 'P2002' && error.meta?.target.includes('email')) {
  // Handle email uniqueness violation specifically
}
```

### 2. Use HTTP Status Codes Consistently

Map Prisma errors to appropriate HTTP status codes:

- 400 Bad Request: Validation errors, invalid input
- 404 Not Found: Record not found
- 409 Conflict: Unique constraint violations
- 500 Internal Server Error: Unknown errors
- 503 Service Unavailable: Connection issues

### 3. Provide Meaningful Error Messages

Convert technical error messages to user-friendly ones:

```typescript
// Instead of
throw error;

// Do
throw new Error('A carrier with this name already exists');
```

### 4. Log Detailed Error Information

Log detailed error information for debugging while returning simplified messages to users:

```typescript
logger.error('Database error', {
  code: error.code,
  meta: error.meta,
  stack: error.stack
});

return res.status(400).json({
  error: 'Invalid data provided'
});
```

### 5. Implement Centralized Error Handling

Use middleware or service-level error handlers to ensure consistent error handling:

```typescript
// In a base service class
protected handlePrismaError(error: any, operation: string): never {
  // Common error handling logic
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Handle known errors
  }
  
  // Log and rethrow
  this.logger.error(`${operation} failed`, error);
  throw error;
}

// In derived services
try {
  return await prisma.insuranceCarrier.create({ data });
} catch (error) {
  this.handlePrismaError(error, 'createCarrier');
}
```

## Conclusion

Proper error handling is crucial for maintaining a robust application. By understanding and appropriately handling Prisma error codes, you can provide better user experience and make debugging easier. Always tailor your error handling strategy to your application's specific needs and ensure consistent handling across all services.
