# Insurance Database Project

A comprehensive database system for dental insurance information with a focus on modeling network-carrier-plan hierarchies.

## Features

- Network-carrier-plan hierarchical structure
- Procedure requirement tracking
- Documentation guidelines
- Vector search for semantic queries
- Integration with AI agents

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

### Building and Running

- Development mode: `npm run dev`
- Build: `npm run build`
- Start: `npm run start`

## Testing

- Run tests: `npm test`
- Run tests with coverage: `npm run test:coverage`
