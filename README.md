# Insurance Database

A comprehensive dental insurance database system with network-carrier-plan hierarchy modeling, vector search capabilities, and Prisma ORM integration.

## Features

- Network-carrier-plan hierarchical structure
- Procedure requirement tracking
- Documentation guidelines
- Vector search for semantic querying
- Integration with AI agents
- Prisma ORM for type-safe database access
- Optimized query performance with specialized indexes
- Redis caching for improved response times

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database (local or cloud)
- Redis (for caching)
- Docker (for local development)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/insurance-database.git
   cd insurance-database
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Update the `.env` file with your database connection details.

4. Start local development environment:
   ```bash
   docker-compose up -d
   ```

5. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```

6. Run database migrations:
   ```bash
   supabase db reset
   ```

7. Start the application:
   ```bash
   npm run dev
   ```

## API Endpoints

The API provides access to insurance carriers, procedures, and guidelines:

- `/api/carriers` - Insurance carrier management
- `/api/procedures` - Dental procedure code lookup
- `/api/guidelines` - Documentation requirements and policies

Prisma-powered endpoints are available at:

- `/api/prisma/carriers` - Prisma implementation of carrier endpoints
- `/api/prisma/procedures` - Prisma implementation of procedure endpoints
- `/api/prisma/guidelines` - Prisma implementation of guideline endpoints

## Development

### Database Management

This project follows a SQL-first approach with Prisma as an ORM:

1. Make schema changes in SQL migration files (`supabase/migrations/`)
2. Apply migrations to your database (`supabase db reset` or `supabase migration up`)
3. Sync Prisma schema (`npm run prisma:pull`)
4. Generate Prisma client (`npm run prisma:generate`)

See [Prisma Schema Workflow](./docs/development/prisma-schema-workflow.md) for details.

### Performance Optimization

The project includes several performance optimizations:

- Specialized database indexes for text and vector search
- Query optimization techniques with selective field fetching
- Connection pooling with retry logic
- Redis caching with smart invalidation
- Monitoring middleware for query performance

See [Performance Optimization](./docs/development/prisma-phase7-completion.md) for details on implementation.

### Testing

Run the test suite with:

```bash
npm test
```

Run specific test types:

```bash
# Unit tests
npm test -- --testPathPattern="unit"

# Integration tests
npm test -- --testPathPattern="integration"

# Performance tests
npm run test:perf
```

## Implementation Status

The Prisma ORM implementation is in progress. Current status:

- ✅ Phase 1: Setup & Configuration
- ✅ Phase 2: Schema Synchronization
- ✅ Phase 3: Prisma Client Integration
- ✅ Phase 4: Service Layer Migration
- ✅ Phase 5: API Layer Updates
- ✅ Phase 6: Testing & Validation
- ✅ Phase 7: Performance Optimization
- ⬜ Phase 8: Documentation & Knowledge Transfer
- ⬜ Phase 9: Deployment & CI/CD Updates
- ⬜ Phase 10: Specific Functionality Implementation
- ⬜ Phase 11: Final Integration and Rollout
- ⬜ Phase 12: RAG Integration Updates

## License

This project is licensed under the MIT License - see the LICENSE file for details.
