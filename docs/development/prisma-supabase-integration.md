# Prisma + Supabase Integration Pattern

This document outlines the approach for integrating Prisma ORM with Supabase in the Insurance Database project, explaining which features are used from each tool and how they work together.

## Integration Overview

Our project uses a hybrid approach that leverages the strengths of both Prisma and Supabase:

- **Prisma ORM:** Used for database querying, type-safe access, and model definition
- **Supabase:** Used for Auth, Storage, and RLS (Row Level Security)

This approach gives us the best of both worlds: Prisma's excellent developer experience with type safety and Supabase's powerful features for authentication and file storage.

## Architecture Diagram

```
┌────────────────────┐    ┌─────────────────────┐
│    Client App      │    │  Backend Services   │
│  (Next.js, React)  │    │  (Express, Node.js) │
└─────────┬──────────┘    └──────────┬──────────┘
          │                          │
          │  ┌──────────────────────┐│
          └──┤ Supabase Auth & SDK  ├┘
             └──────────┬───────────┘
                        │
             ┌──────────┴───────────┐
             │    Prisma Client     │
             └──────────┬───────────┘
                        │
             ┌──────────┴───────────┐
             │  PostgreSQL Database │
             │   (Supabase or Any)  │
             └────────────────────────
```

## Source of Truth for Schema

We follow a **SQL-first approach** where:

1. SQL migrations (in `supabase/migrations/`) are the source of truth for the database schema
2. Prisma schema (`schema.prisma`) is generated from the database via introspection
3. Prisma Client types are generated from the Prisma schema

This approach ensures compatibility with Supabase's migration system while allowing us to use Prisma's powerful querying capabilities.

## Component Integration Details

### Database Query Layer (Prisma)

Prisma is used as our primary data access layer, providing:

- **Type-safe queries:** Autocomplete and type checking for database operations
- **Complex filtering:** Advanced query capabilities (relations, pagination, filtering)
- **Transaction support:** Atomic operations spanning multiple tables
- **Advanced features:** Raw queries for specialized operations (vector search)

Implementation:
- Singleton Prisma client instance in `src/lib/prisma.ts`
- Service layer in `src/api/services/prisma/` with model-specific services
- Error handling middleware for Prisma-specific errors

### Authentication (Supabase Auth)

Supabase Auth provides:

- **User authentication:** Sign-up, sign-in, password reset flows
- **OAuth providers:** Social login options
- **JWT handling:** Secure token generation and validation
- **User management:** User profiles, roles, and permissions

Implementation:
- Supabase Auth SDK in client applications
- JWT validation middleware in API endpoints
- RLS policies in the database to secure data access

### File Storage (Supabase Storage)

Supabase Storage provides:

- **Document storage:** For insurance carrier documents
- **File uploads:** Secure, authenticated file uploads
- **Access control:** Policies for file access based on user roles
- **CDN delivery:** Fast file serving with caching

Implementation:
- Storage buckets configured for different file types
- Direct uploads from client when appropriate
- Server-side uploads for processed files

### Row Level Security (RLS)

RLS is implemented at the database level to ensure data security:

- **Table policies:** Define who can read, create, update, and delete records
- **Dynamic rules:** Access rules based on user ID, role, and other attributes
- **Zero-trust model:** Default deny all, explicit allow for specific operations

Implementation:
- RLS policies defined in SQL migrations
- Policies automatically applied regardless of access method (Prisma or Supabase)

## Workflow Examples

### Schema Changes Workflow

1. **Create SQL migration:**
   ```bash
   supabase migration new add_field_to_carrier
   ```

2. **Edit the migration file:**
   ```sql
   ALTER TABLE insurance_carriers
   ADD COLUMN website VARCHAR(255);
   ```

3. **Apply migration:**
   ```bash
   supabase db reset
   # or for incremental updates
   supabase migration up
   ```

4. **Update Prisma schema:**
   ```bash
   npm run prisma:pull
   ```

5. **Refine schema:**
   Edit `prisma/schema.prisma` to add proper mapping, documentation, etc.

6. **Generate Prisma Client:**
   ```bash
   npm run prisma:generate
   ```

7. **Use in code:**
   ```typescript
   // Now available in your code
   const carriersWithWebsites = await prisma.insuranceCarrier.findMany({
     where: {
       website: { not: null }
     }
   });
   ```

### Authentication Workflow

1. **Client-side authentication:**
   ```typescript
   // React component using Supabase auth
   import { useSupabaseClient } from '@supabase/auth-helpers-react';

   const LoginComponent = () => {
     const supabase = useSupabaseClient();
     
     const handleLogin = async () => {
       const { data, error } = await supabase.auth.signInWithPassword({
         email,
         password
       });
       // Handle result
     };
     
     return (/* Login form */);
   };
   ```

2. **API authentication middleware:**
   ```typescript
   // Express middleware to validate Supabase JWT
   import { createClient } from '@supabase/supabase-js';

   export const authMiddleware = async (req, res, next) => {
     const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
     const token = req.headers.authorization?.split(' ')[1];
     
     if (!token) {
       return res.status(401).json({ error: 'Missing authorization token' });
     }
     
     try {
       const { data, error } = await supabase.auth.getUser(token);
       
       if (error) throw error;
       
       req.user = data.user;
       next();
     } catch (error) {
       return res.status(401).json({ error: 'Invalid token' });
     }
   };
   ```

3. **Using Prisma with authenticated user context:**
   ```typescript
   // Service with user context from auth
   export const getCarriersForUser = async (userId) => {
     return prisma.insuranceCarrier.findMany({
       where: {
         // Apply filters based on user permissions
         // RLS will also be enforced at DB level
       }
     });
   };
   ```

### File Storage Workflow

1. **Configure storage bucket:**
   ```sql
   -- In a migration file
   INSERT INTO storage.buckets (id, name, public) 
   VALUES ('carrier_documents', 'Carrier Documents', false);
   
   -- Create RLS policy
   CREATE POLICY "Users can access their own documents"
   ON storage.objects
   FOR SELECT
   USING (auth.uid() = owner);
   ```

2. **Upload file via backend:**
   ```typescript
   // Server-side file upload
   const uploadDocument = async (
     file: Buffer, 
     fileName: string, 
     carrierId: number,
     userId: string
   ) => {
     // 1. Upload to Supabase Storage
     const supabase = createClient(/* config */);
     const { data, error } = await supabase
       .storage
       .from('carrier_documents')
       .upload(`${carrierId}/${fileName}`, file, {
         upsert: false,
         contentType: 'application/pdf'
       });
     
     if (error) throw error;
     
     // 2. Create record in database using Prisma
     return prisma.carrierDocument.create({
       data: {
         carrierId,
         filename: fileName,
         metadata: {
           storagePath: data.path,
           uploadedBy: userId
         }
       }
     });
   };
   ```

3. **Read file metadata with Prisma, access file with Supabase:**
   ```typescript
   // Client-side file access
   const getDocumentWithContent = async (documentId) => {
     // 1. Get metadata using Prisma
     const document = await prisma.carrierDocument.findUnique({
       where: { id: documentId }
     });
     
     // 2. Get file from Supabase Storage
     const { data, error } = await supabase
       .storage
       .from('carrier_documents')
       .download(document.metadata.storagePath);
     
     if (error) throw error;
     
     return {
       metadata: document,
       content: data
     };
   };
   ```

## Advanced Features

### Vector Search with Prisma Raw Queries

```typescript
// Semantic search implementation with Prisma raw queries
const semanticSearch = async (query: string, options = {}) => {
  // 1. Generate embedding from OpenAI
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: query
  });
  
  // 2. Use Prisma.$queryRaw to execute vector search
  const results = await prisma.$queryRaw`
    SELECT
      id,
      title,
      content,
      embedding <=> ${embedding.data[0].embedding}::vector as similarity
    FROM guidelines
    WHERE embedding IS NOT NULL
    ORDER BY similarity ASC
    LIMIT 10
  `;
  
  return results;
};
```

### Mixing Supabase and Prisma for Complex Queries

In some cases, you may need to use both Supabase and Prisma for different parts of an operation:

```typescript
// Example: Full text search with RLS via Supabase, then rich data loading via Prisma
const searchGuidelinesWithUserContext = async (query: string, userId: string) => {
  // 1. Use Supabase with RLS to get IDs of accessible guidelines
  const { data, error } = await supabase
    .from('guidelines')
    .select('id')
    .textSearch('content', query)
    .eq('user_id', userId);
  
  if (error) throw error;
  
  // 2. Use Prisma to get full data with relations for these IDs
  return prisma.guideline.findMany({
    where: {
      id: { in: data.map(item => item.id) }
    },
    include: {
      document: {
        select: {
          filename: true,
          carrier: {
            select: {
              carrierName: true
            }
          }
        }
      }
    }
  });
};
```

## Best Practices

### Database Connection Management

1. **Development Environment:**
   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres?schema=public"
   ```

2. **Production Environment (Supabase Cloud):**
   ```
   DATABASE_URL="postgresql://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:5432/postgres?schema=public"
   ```

3. **Connection Pooling:**
   - Use direct connection for Prisma migrations and introspection
   - Use connection pooler for application queries in production

### Error Handling Strategy

1. **Prisma-specific error handling:**
   ```typescript
   try {
     return await prisma.insuranceCarrier.create({
       data: { /* ... */ }
     });
   } catch (error) {
     if (error instanceof Prisma.PrismaClientKnownRequestError) {
       // Handle Prisma-specific errors (e.g., unique constraint)
     } else {
       // Handle generic errors
     }
   }
   ```

2. **Supabase error handling:**
   ```typescript
   const { data, error } = await supabase.auth.signIn({ /* ... */ });
   
   if (error) {
     console.error('Authentication error:', error);
     throw new Error(`Auth failed: ${error.message}`);
   }
   ```

3. **Combining error handling:**
   Create unified error types that handle both Prisma and Supabase errors.

### Transaction Management

Prisma transactions are used for operations that need to maintain database integrity:

```typescript
// Example: Create carrier and document in a single transaction
const createCarrierWithDocument = async (
  carrierData,
  documentData,
  fileBuffer
) => {
  // First upload file to Supabase Storage
  const { data: storageData, error } = await supabase
    .storage
    .from('carrier_documents')
    .upload(/* ... */);
  
  if (error) throw error;
  
  // Then use Prisma transaction for database operations
  return prisma.$transaction(async (tx) => {
    // Create carrier
    const carrier = await tx.insuranceCarrier.create({
      data: carrierData
    });
    
    // Create document linking to carrier
    const document = await tx.carrierDocument.create({
      data: {
        ...documentData,
        carrierId: carrier.id,
        metadata: {
          storagePath: storageData.path
        }
      }
    });
    
    return { carrier, document };
  });
};
```

## Troubleshooting

### Schema Drift

If Prisma schema and database schema become out of sync:

1. Check migration status:
   ```bash
   supabase migration list
   ```

2. Reset Prisma schema:
   ```bash
   npm run prisma:pull
   ```

3. Compare differences and resolve conflicts manually.

### Authentication Issues

1. Verify JWT configuration:
   ```bash
   # Check JWT settings in Supabase project
   supabase jwt
   ```

2. Ensure environment variables are set correctly:
   ```
   SUPABASE_URL=https://[PROJECT_REF].supabase.co
   SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
   ```

3. Test authentication flow in isolation.

### Connection Issues

1. Verify connection string format:
   ```
   # Standard format
   postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]?schema=public
   ```

2. Check network access:
   ```bash
   # Test connection
   psql "[CONNECTION_STRING]" -c "SELECT 1"
   ```

3. Verify credentials and permissions.

## Conclusion

This hybrid approach combines the strengths of both tools:

- **Prisma:** Type safety, powerful queries, and ORM features
- **Supabase:** Auth, storage, and RLS security

By using SQL migrations as the source of truth and generating the Prisma schema from the database, we maintain compatibility with both systems while leveraging their strengths for different aspects of the application.
