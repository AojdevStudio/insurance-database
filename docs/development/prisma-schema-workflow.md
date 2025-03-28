# Prisma Schema Management Workflow

This document outlines the workflow for managing database schema changes with Prisma while using Supabase as the SQL migration source of truth.

## Key Principles

1. **SQL Migrations as Source of Truth**: All database schema changes should be made in SQL migration files first (in `supabase/migrations`).
2. **Prisma Schema as Generated Artifact**: The `schema.prisma` file is treated as a generated artifact that reflects the database state.
3. **Prisma Client for Data Access**: Use Prisma Client for all database interactions in the application code.

## Workflow for Schema Changes

### 1. Create/Modify SQL Migration

Create a new SQL migration file in the `supabase/migrations` directory:

```bash
supabase migration new <migration_name>
```

Edit the generated file to include your schema changes.

**Example**:
```sql
-- Example migration to add a column
ALTER TABLE insurance_carriers 
ADD COLUMN payer_id VARCHAR(20);
```

### 2. Apply Migration to Database

Apply the migration to your local development database:

```bash
supabase db reset
```

or for incremental updates:

```bash
supabase migration up
```

### 3. Synchronize Prisma Schema

Pull the updated database schema into Prisma:

```bash
npm run prisma:pull
```

### 4. Review and Refine Schema

Review the changes in `prisma/schema.prisma`. You may need to:

- Add or adjust `@map` and `@@map` annotations to align naming conventions
- Ensure relationships are properly defined
- Add documentation comments using `///`

**Example**:
```prisma
/// Newly added payer_id field
payer_id  String?  @map("payer_id")
```

### 5. Generate Prisma Client

Generate the updated Prisma Client:

```bash
npm run prisma:generate
```

### 6. Update Application Code

Update your application code to utilize the new schema elements through Prisma Client.

## Best Practices

1. **Small, Focused Migrations**: Make schema changes in small, focused migrations rather than large, sweeping changes.
2. **Test Migrations**: Test migrations locally before applying to staging/production.
3. **Document Relationships**: Use the `///` comment syntax to document relationships and model purposes.
4. **Consistent Naming**: Use camelCase for Prisma model and field names, with proper `@map`/`@@map` to maintain snake_case in the database.
5. **Version Control**: Commit both SQL migrations and the updated Prisma schema together.

## Common Issues and Solutions

### Schema Drift

If you notice differences between the database state and Prisma schema:

1. Verify all migrations have been applied correctly
2. Run `prisma db pull` to synchronize
3. Compare the differences and resolve any conflicts

### Missing Relations

If relations aren't properly detected:

1. Ensure foreign keys are properly defined in SQL migrations
2. Manually add `@relation` attribute in the Prisma schema
3. Regenerate Prisma Client

## Deployment Considerations

1. **CI/CD Integration**: Ensure your CI/CD pipeline runs `prisma generate` after installing dependencies.
2. **Application Deployment**: Deploy schema changes before deploying application code that depends on those changes.
3. **Environment Consistency**: Maintain consistency between local, staging, and production environments.
