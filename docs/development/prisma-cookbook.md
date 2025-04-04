# Prisma Query Cookbook

This document provides practical examples of common Prisma query patterns used in the Insurance Database project. Use these examples as reference when implementing new features or optimizing existing ones.

## Table of Contents

1. [Basic Queries](#basic-queries)
2. [Filtering and Pagination](#filtering-and-pagination)
3. [Relations and Includes](#relations-and-includes)
4. [Advanced Filtering](#advanced-filtering)
5. [Aggregations](#aggregations)
6. [Transactions](#transactions)
7. [Raw Queries](#raw-queries)
8. [Vector Search](#vector-search)
9. [Performance Optimization](#performance-optimization)
10. [Error Handling](#error-handling)

## Basic Queries

### Finding a Single Record

```typescript
// Find by ID
const carrier = await prisma.insuranceCarrier.findUnique({
  where: { id: 123 }
});

// Find by unique field
const procedure = await prisma.procedure.findUnique({
  where: { procedureCode: 'D1110' }
});

// Find first matching record
const blueCarrier = await prisma.insuranceCarrier.findFirst({
  where: {
    carrierName: { contains: 'Blue', mode: 'insensitive' }
  }
});
```

### Creating Records

```typescript
// Create a single record
const newCarrier = await prisma.insuranceCarrier.create({
  data: {
    carrierName: 'New Insurance Company',
    carrierType: 'National',
    payerId: 'NIC123'
  }
});

// Create multiple records
const newProcedures = await prisma.procedure.createMany({
  data: [
    { procedureCode: 'D2140', description: 'Amalgam - one surface' },
    { procedureCode: 'D2150', description: 'Amalgam - two surfaces' },
    { procedureCode: 'D2160', description: 'Amalgam - three surfaces' }
  ],
  skipDuplicates: true // Skip if procedureCode already exists
});
```

### Updating Records

```typescript
// Update a single record
const updatedCarrier = await prisma.insuranceCarrier.update({
  where: { id: 123 },
  data: {
    phoneNumber: '1-800-555-1234'
  }
});

// Update multiple records
const updatedProcedures = await prisma.procedure.updateMany({
  where: {
    category: 'Preventive'
  },
  data: {
    category: 'Diagnostic/Preventive'
  }
});
```

### Deleting Records

```typescript
// Delete a single record
const deletedDocument = await prisma.carrierDocument.delete({
  where: { id: 456 }
});

// Delete multiple records
const deletedProcedures = await prisma.documentProcedure.deleteMany({
  where: {
    documentId: 456
  }
});
```

## Filtering and Pagination

### Basic Filtering

```typescript
// Text matching
const carriers = await prisma.insuranceCarrier.findMany({
  where: {
    carrierName: {
      contains: 'Blue',
      mode: 'insensitive' // Case-insensitive search
    }
  }
});

// Numeric comparison
const recentDocuments = await prisma.carrierDocument.findMany({
  where: {
    totalPages: {
      gt: 10 // Greater than 10 pages
    }
  }
});

// Date filtering
const documentsThisMonth = await prisma.carrierDocument.findMany({
  where: {
    createdAt: {
      gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) // First day of current month
    }
  }
});
```

### Combining Filters with OR/AND

```typescript
// OR filter
const carrierResults = await prisma.insuranceCarrier.findMany({
  where: {
    OR: [
      { carrierName: { contains: 'Blue', mode: 'insensitive' } },
      { carrierName: { contains: 'Dental', mode: 'insensitive' } }
    ]
  }
});

// AND filter
const specificCarriers = await prisma.insuranceCarrier.findMany({
  where: {
    AND: [
      { carrierType: 'National' },
      { createdAt: { gt: new Date('2024-01-01') } }
    ]
  }
});

// Complex filter
const filteredProcedures = await prisma.procedure.findMany({
  where: {
    OR: [
      {
        AND: [
          { category: 'Restorative' },
          { procedureCode: { startsWith: 'D2' } }
        ]
      },
      {
        AND: [
          { category: 'Preventive' },
          { procedureCode: { startsWith: 'D11' } }
        ]
      }
    ]
  }
});
```

### Pagination and Sorting

```typescript
// Basic pagination
const paginatedCarriers = await prisma.insuranceCarrier.findMany({
  skip: 20, // Skip first 20 records
  take: 10, // Take 10 records
});

// Pagination with sorting
const sortedCarriers = await prisma.insuranceCarrier.findMany({
  skip: (page - 1) * pageSize,
  take: pageSize,
  orderBy: {
    carrierName: 'asc'
  }
});

// Multiple sort fields
const complexSort = await prisma.procedure.findMany({
  orderBy: [
    { category: 'asc' },
    { procedureCode: 'asc' }
  ],
  take: 50
});

// Cursor-based pagination (more efficient for large datasets)
const cursorPagination = await prisma.guideline.findMany({
  take: 10,
  cursor: { id: lastId },
  orderBy: { id: 'asc' }
});
```

## Relations and Includes

### One-to-Many Relationships

```typescript
// Get a carrier with its documents
const carrierWithDocuments = await prisma.insuranceCarrier.findUnique({
  where: { id: 123 },
  include: {
    documents: true
  }
});

// Get a document with its pages
const documentWithPages = await prisma.carrierDocument.findUnique({
  where: { id: 456 },
  include: {
    pages: {
      orderBy: {
        pageNumber: 'asc'
      }
    }
  }
});

// Filter the included relations
const carrierWithRecentDocuments = await prisma.insuranceCarrier.findUnique({
  where: { id: 123 },
  include: {
    documents: {
      where: {
        createdAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - 30)) // Last 30 days
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    }
  }
});
```

### Many-to-Many Relationships

```typescript
// Get networks with their carriers
const networksWithCarriers = await prisma.insuranceNetwork.findMany({
  include: {
    carrierRelationships: {
      include: {
        carrier: true
      }
    }
  }
});

// Get procedures with carrier requirements
const proceduresWithRequirements = await prisma.procedure.findMany({
  where: {
    category: 'Preventive'
  },
  include: {
    carrierRequirements: {
      include: {
        carrier: true
      }
    }
  }
});
```

### Nested Relations

```typescript
// Get networks with carriers and their plans
const networksCarriersPlans = await prisma.insuranceNetwork.findMany({
  include: {
    carrierRelationships: {
      include: {
        carrier: {
          include: {
            plans: true
          }
        }
      }
    }
  }
});

// Selective field inclusion
const procedureWithSelectiveRequirements = await prisma.procedure.findUnique({
  where: { id: 123 },
  include: {
    carrierRequirements: {
      select: {
        documentationRequired: true,
        frequencyLimitation: true,
        carrier: {
          select: {
            carrierName: true,
            payerId: true
          }
        }
      }
    }
  }
});
```

## Advanced Filtering

### JSON Filtering

```typescript
// Filter on JSON field (requires PostgreSQL)
const documentsWithSpecificMetadata = await prisma.carrierDocument.findMany({
  where: {
    metadata: {
      path: ['source'],
      equals: 'website'
    }
  }
});

// JSON array filtering
const guidelinesWithTags = await prisma.guideline.findMany({
  where: {
    metadata: {
      path: ['tags'],
      array_contains: ['important']
    }
  }
});
```

### Full-Text Search

```typescript
// Full-text search (requires PostgreSQL)
const guidelinesTextSearch = await prisma.guideline.findMany({
  where: {
    OR: [
      {
        title: {
          search: 'authorization requirements',
        },
      },
      {
        content: {
          search: 'authorization requirements',
        },
      },
    ],
  },
});

// More advanced full-text search with relevance sorting
// Note: Requires the fullTextSearch preview feature
const searchResults = await prisma.$queryRaw`
  SELECT 
    id, 
    title, 
    content, 
    ts_rank(to_tsvector('english', title || ' ' || content), plainto_tsquery('english', ${searchQuery})) as rank
  FROM guidelines
  WHERE to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', ${searchQuery})
  ORDER BY rank DESC
  LIMIT 20
`;
```

## Aggregations

### Count, Sum, Average

```typescript
// Count records
const carrierCount = await prisma.insuranceCarrier.count();

// Count with filter
const nationalCarrierCount = await prisma.insuranceCarrier.count({
  where: {
    carrierType: 'National'
  }
});

// Sum values
const totalDocumentPages = await prisma.carrierDocument.aggregate({
  _sum: {
    totalPages: true
  }
});

// Average
const averagePagesPerDocument = await prisma.carrierDocument.aggregate({
  _avg: {
    totalPages: true
  }
});

// Multiple aggregations
const documentStats = await prisma.carrierDocument.aggregate({
  _count: true,
  _sum: {
    totalPages: true
  },
  _avg: {
    totalPages: true
  },
  _min: {
    totalPages: true
  },
  _max: {
    totalPages: true
  }
});
```

### Group By

```typescript
// Group carriers by type with counts
const carriersByType = await prisma.insuranceCarrier.groupBy({
  by: ['carrierType'],
  _count: true,
  orderBy: {
    _count: {
      carrierType: 'desc'
    }
  }
});

// Group procedures by category with counts
const proceduresByCategory = await prisma.procedure.groupBy({
  by: ['category'],
  _count: {
    procedureCode: true
  },
  orderBy: {
    _count: {
      procedureCode: 'desc'
    }
  }
});

// Complex grouping
const documentStatsByCarrier = await prisma.carrierDocument.groupBy({
  by: ['carrierId'],
  _count: {
    id: true
  },
  _sum: {
    totalPages: true
  },
  _avg: {
    totalPages: true
  },
  having: {
    carrierId: {
      not: null
    }
  }
});
```

## Transactions

### Basic Transaction

```typescript
// Use transaction to ensure all operations succeed or all fail
const [newCarrier, newPlan] = await prisma.$transaction([
  prisma.insuranceCarrier.create({
    data: {
      carrierName: 'New Insurance Co',
      carrierType: 'National'
    }
  }),
  prisma.insurancePlan.create({
    data: {
      carrierId: 123, // Note: Would use the newCarrier.id in interactive transaction
      planName: 'Premium Dental Plan',
      planType: 'PPO'
    }
  })
]);
```

### Interactive Transactions

```typescript
// Interactive transaction allows using results from previous steps
const result = await prisma.$transaction(async (tx) => {
  // Create carrier
  const carrier = await tx.insuranceCarrier.create({
    data: {
      carrierName: 'New Insurance Co',
      carrierType: 'National'
    }
  });
  
  // Use carrier.id in creating a plan
  const plan = await tx.insurancePlan.create({
    data: {
      carrierId: carrier.id,
      planName: 'Premium Dental Plan',
      planType: 'PPO'
    }
  });

  // Create alias using carrier.id
  const alias = await tx.carrierAlias.create({
    data: {
      carrierId: carrier.id,
      aliasName: 'NIC Insurance'
    }
  });
  
  return { carrier, plan, alias };
});
```

### Transaction Options

```typescript
// Transaction with timeout and isolation level
const result = await prisma.$transaction(
  async (tx) => {
    // Transaction operations...
    const carrier = await tx.insuranceCarrier.findUnique({
      where: { id: 123 }
    });
    
    // Update the carrier
    const updated = await tx.insuranceCarrier.update({
      where: { id: 123 },
      data: {
        carrierName: 'Updated Name'
      }
    });
    
    return updated;
  },
  {
    maxWait: 5000, // Maximum time to wait for transaction lock (ms)
    timeout: 10000, // Maximum time transaction can run (ms)
    isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted // Isolation level
  }
);
```

## Raw Queries

### Simple Raw Queries

```typescript
// Execute a raw query with parameters
const carriers = await prisma.$queryRaw`
  SELECT id, carrier_name, carrier_type 
  FROM insurance_carriers
  WHERE carrier_name ILIKE ${`%Blue%`}
  ORDER BY carrier_name
  LIMIT 10
`;

// Use parameter placeholders for better safety
const procedures = await prisma.$queryRaw`
  SELECT p.id, p.procedure_code, p.description, count(cpr.id) as requirement_count
  FROM procedures p
  LEFT JOIN carrier_procedure_requirements cpr ON p.id = cpr.procedure_id
  WHERE p.category = ${category}
  GROUP BY p.id, p.procedure_code, p.description
  HAVING count(cpr.id) > 0
  ORDER BY requirement_count DESC
`;
```

### Type-Safe Raw Queries

```typescript
// Type-safe raw query (infers the return type)
const carriers = await prisma.$queryRaw<Array<{ id: number; name: string; type: string }>>`
  SELECT id, carrier_name as name, carrier_type as type
  FROM insurance_carriers
  ORDER BY carrier_name
  LIMIT 10
`;

// Type-safe query with complex return type
interface CarrierWithCount {
  id: number;
  carrier_name: string;
  document_count: number;
}

const carriersWithDocuments = await prisma.$queryRaw<CarrierWithCount[]>`
  SELECT 
    ic.id, 
    ic.carrier_name, 
    COUNT(cd.id) as document_count
  FROM insurance_carriers ic
  LEFT JOIN carrier_documents cd ON ic.id = cd.carrier_id
  GROUP BY ic.id, ic.carrier_name
  HAVING COUNT(cd.id) > 0
  ORDER BY document_count DESC
  LIMIT 10
`;
```

### Executing Raw SQL (Non-SELECT)

```typescript
// For DML (INSERT, UPDATE, DELETE) operations use $executeRaw
const deletedCount = await prisma.$executeRaw`
  DELETE FROM document_pages
  WHERE document_id = ${documentId}
  AND page_number > ${maxPageNumber}
`;

// Update multiple records
const updatedCount = await prisma.$executeRaw`
  UPDATE procedures
  SET category = ${newCategory}
  WHERE category = ${oldCategory}
  AND procedure_code LIKE ${`D${codePrefix}%`}
`;
```

## Vector Search

### Basic Vector Similarity Search

```typescript
// Execute vector search using raw SQL (for OpenAI embeddings)
// This example assumes a vector embedding field is available
const vectorSearch = async (embedding: number[], limit = 10) => {
  // Convert embedding array to string for SQL
  const embeddingString = `[${embedding.join(',')}]`;
  
  // Execute raw query with vector comparison
  const results = await prisma.$queryRaw`
    SELECT 
      id, 
      title, 
      content, 
      embedding <=> ${embeddingString}::vector as similarity
    FROM guidelines
    WHERE embedding IS NOT NULL
    ORDER BY similarity ASC
    LIMIT ${limit}
  `;
  
  return results;
};
```

### Hybrid Search (Combining Vector and Text)

```typescript
// Hybrid search combining vector and text similarity
const hybridSearch = async (
  query: string, 
  embedding: number[], 
  textWeight = 0.3, 
  vectorWeight = 0.7,
  limit = 10
) => {
  // Convert embedding array to string for SQL
  const embeddingString = `[${embedding.join(',')}]`;
  
  // Execute raw query with combined scoring
  const results = await prisma.$queryRaw`
    SELECT 
      g.id, 
      g.title, 
      g.content, 
      g.carrier_id,
      g.category,
      g.created_at,
      similarity(g.content, ${query}) as text_similarity,
      g.embedding <=> ${embeddingString}::vector as vector_similarity,
      (${textWeight} * similarity(g.content, ${query})) + 
      (${vectorWeight} * (1 - (g.embedding <=> ${embeddingString}::vector))) as combined_similarity
    FROM guidelines g
    WHERE 
      (${textWeight} * similarity(g.content, ${query})) + 
      (${vectorWeight} * (1 - (g.embedding <=> ${embeddingString}::vector))) > 0.5
    ORDER BY combined_similarity DESC
    LIMIT ${limit}
  `;
  
  return results;
};
```

### RRF Hybrid Search (Reciprocal Rank Fusion)

```typescript
// RRF hybrid search implementation
const rrfHybridSearch = async (
  query: string,
  embedding: number[],
  limit = 10,
  rrfK = 60.0
) => {
  const embeddingString = `[${embedding.join(',')}]`;
  
  const results = await prisma.$queryRaw`
    WITH text_ranks AS (
      SELECT 
        g.id, 
        ROW_NUMBER() OVER (ORDER BY similarity(g.content, ${query}) DESC) as text_rank
      FROM guidelines g
      WHERE similarity(g.content, ${query}) > 0.3
    ),
    vector_ranks AS (
      SELECT 
        g.id, 
        ROW_NUMBER() OVER (ORDER BY g.embedding <=> ${embeddingString}::vector) as vector_rank
      FROM guidelines g
      WHERE g.embedding <=> ${embeddingString}::vector < 0.7
    )
    SELECT 
      g.id, 
      g.title, 
      g.content, 
      g.carrier_id, 
      g.category,
      g.created_at,
      similarity(g.content, ${query}) as text_similarity,
      g.embedding <=> ${embeddingString}::vector as vector_similarity,
      COALESCE(1.0 / (${rrfK} + tr.text_rank), 0) + 
      COALESCE(1.0 / (${rrfK} + vr.vector_rank), 0) as rrf_score
    FROM guidelines g
    LEFT JOIN text_ranks tr ON g.id = tr.id
    LEFT JOIN vector_ranks vr ON g.id = vr.id
    WHERE tr.id IS NOT NULL OR vr.id IS NOT NULL
    ORDER BY rrf_score DESC
    LIMIT ${limit}
  `;
  
  return results;
};
```

## Performance Optimization

### Selective Field Fetching

```typescript
// Only fetch required fields (more efficient)
const carriers = await prisma.insuranceCarrier.findMany({
  select: {
    id: true,
    carrierName: true,
    carrierType: true
  },
  where: {
    carrierType: 'National'
  }
});

// Optimize nested selects to minimize data transfer
const procedures = await prisma.procedure.findMany({
  select: {
    id: true,
    procedureCode: true,
    description: true,
    carrierRequirements: {
      select: {
        documentationRequired: true,
        carrier: {
          select: {
            carrierName: true
          }
        }
      },
      where: {
        documentationRequired: {
          not: null
        }
      }
    }
  }
});
```

### Batching Operations

```typescript
// Use createMany instead of multiple create calls
await prisma.procedure.createMany({
  data: proceduresToCreate,
  skipDuplicates: true
});

// Use updateMany for batch updates
await prisma.guideline.updateMany({
  where: {
    carrierId: carrierId
  },
  data: {
    category: newCategory
  }
});

// Use $transaction for complex batch operations
await prisma.$transaction(
  proceduresToCreate.map(proc => 
    prisma.procedure.upsert({
      where: { procedureCode: proc.procedureCode },
      update: proc,
      create: proc
    })
  )
);
```

### Query Optimization Techniques

```typescript
// Use count with _count projection for better performance
const result = await prisma.insuranceCarrier.findMany({
  where: {
    carrierType: 'National'
  },
  include: {
    _count: {
      select: { documents: true }
    }
  }
});

// Use pagination to limit result size
const paginatedResults = await prisma.procedure.findMany({
  skip: (page - 1) * pageSize,
  take: pageSize
});

// Use cursor-based pagination for large datasets (more efficient than offset)
const results = await prisma.guideline.findMany({
  take: 10,
  cursor: lastCursor ? { id: lastCursor } : undefined,
  orderBy: { id: 'asc' }
});
```

## Error Handling

### Handling Prisma-Specific Errors

```typescript
import { Prisma } from '@prisma/client';

try {
  const carrier = await prisma.insuranceCarrier.create({
    data: {
      carrierName: 'New Carrier',
      payerId: 'NC123'
    }
  });
  return carrier;
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Known request errors (error.code is a string)
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        throw new Error(`Carrier with that name or payer ID already exists: ${error.meta?.target}`);
      case 'P2025': // Record not found
        throw new Error('Carrier not found');
      case 'P2003': // Foreign key constraint failed
        throw new Error('Referenced record does not exist');
      case 'P2014': // Invalid ID input
        throw new Error('Invalid ID provided');
      default:
        throw new Error(`Database error: ${error.message}`);
    }
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    // Validation errors (e.g., missing required fields)
    throw new Error(`Validation error: ${error.message}`);
  } else if (error instanceof Prisma.PrismaClientRustPanicError) {
    // Rust client panic
    console.error('Critical database error:', error);
    throw new Error('A critical database error occurred');
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    // Client initialization error
    console.error('Database connection error:', error);
    throw new Error('Unable to connect to the database');
  } else {
    // Unknown error
    console.error('Unknown error:', error);
    throw error;
  }
}
```

### Common Error Codes

```typescript
/**
 * Common Prisma error codes:
 * 
 * P2000: Field too long for type
 * P2001: Record search failed - no record exists
 * P2002: Unique constraint failed
 * P2003: Foreign key constraint failed
 * P2004: Constraint violation
 * P2005: Invalid value for field type
 * P2006: Invalid value - expected another value
 * P2007: Validation error
 * P2008: Failed query parsing
 * P2009: Failed query validation
 * P2010: Raw query failed
 * P2011: Null constraint violation
 * P2012: Missing required field
 * P2013: Missing required argument
 * P2014: Invalid ID input
 * P2015: Related record not found
 * P2016: Query interpretation error
 * P2017: Records in relation not connected
 * P2018: Required connected records not found
 * P2019: Input error
 * P2020: Operation failed
 * P2021: Table does not exist
 * P2022: Column does not exist
 * P2023: Inconsistent data
 * P2024: Connection failed
 * P2025: Record not found
 * P2026: Unsupported request
 * P2027: Multiple errors
 * P2028: Transaction API error
 * P2029: Query not successful
 * P2030: Query engine error
 */

// Example of using error codes for better error messages
function handlePrismaError(error: any): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const errorMessages = {
      'P2002': 'A record with this information already exists.',
      'P2003': 'Referenced record does not exist.',
      'P2025': 'Record not found.',
      // Add other error codes as needed
    };
    
    const message = errorMessages[error.code as keyof typeof errorMessages] || `Database error: ${error.message}`;
    return new Error(message);
  }
  
  return error;
}
```

### Middleware for Logging Errors

```typescript
// Example of Prisma middleware for error logging
prisma.$use(async (params, next) => {
  try {
    return await next(params);
  } catch (error) {
    // Log the error with context
    console.error(`Prisma Error in ${params.model}.${params.action}:`, {
      error,
      params
    });
    
    // You can also log to a monitoring service
    // Sentry.captureException(error, { extra: { prismaOperation: params } });
    
    // Rethrow the error
    throw error;
  }
});
```
