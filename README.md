# Insurance Database Project

A comprehensive database system for dental insurance information with a focus on modeling network-carrier-plan hierarchies.

## Features

- Network-carrier-plan hierarchical structure
- Procedure requirement tracking
- Documentation guidelines
- Vector search for semantic queries
- Integration with AI agents
- Prisma ORM for type-safe database access

## Setup

### Prerequisites

- Node.js 18+
- Docker and Docker Compose (for local development)
- Supabase account (for production)

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Setup environment variables by copying `.env.example` to `.env` and updating the values

4. Start the local database:
```bash
docker-compose up -d
```

5. Run database migrations:
```bash
npm run supabase migration up
```

6. Generate Prisma client:
```bash
npm run prisma:generate
```

## Database Connection

The project uses Prisma ORM to interact with the database. The connection is configured via the `DATABASE_URL` environment variable:

### Local Development
```
DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres?schema=public"
```

### Production (Supabase)
```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@YOUR_INSTANCE.supabase.co:5432/postgres?schema=public"
```

## Development

### Database Operations

- Pull database schema: `npm run prisma:pull`
- Generate Prisma client: `npm run prisma:generate`
- Open Prisma Studio: `npm run prisma:studio`
- Combined pull and generate: `npm run db:pull-generate`

### Building and Running

- Development mode: `npm run dev`
- Build: `npm run build`
- Start: `npm run start`

## API Endpoints

The project provides two sets of API endpoints:

### Supabase API (Original)
- `/api/carriers/*` - Carrier endpoints
- `/api/procedures/*` - Procedure endpoints  
- `/api/guidelines/*` - Guidelines endpoints

### Prisma API (New Implementation)
- `/api/prisma/carriers/*` - Prisma-based carrier endpoints
- `/api/prisma/procedures/*` - Prisma-based procedure endpoints
- `/api/prisma/guidelines/*` - Prisma-based guidelines endpoints

## Schema Management

This project uses a SQL-first approach to schema management:

1. SQL migrations (in `supabase/migrations/`) are the source of truth for schema changes
2. Prisma schema is generated from the database using `prisma db pull`
3. After schema changes, run `npm run db:pull-generate` to update the Prisma client

For detailed workflow information, see [Prisma Schema Workflow](docs/development/prisma-schema-workflow.md).

## Documentation

- [CHANGELOG](CHANGELOG.md) - Project history and changes
- [Prisma Schema Workflow](docs/development/prisma-schema-workflow.md) - How to manage database schema changes
- [Prisma Phase 4 Completion](docs/development/prisma-phase4-completion.md) - Implementation details of service layer migration
- [Prisma Phase 5 Completion](docs/development/prisma-phase5-completion.md) - API layer updates and middleware implementations

## Testing

- Run tests: `npm test`
- Run tests with coverage: `npm run test:coverage`
