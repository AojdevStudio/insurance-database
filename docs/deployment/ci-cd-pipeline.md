# CI/CD Pipeline Documentation

This document describes the CI/CD pipeline for the Insurance Database project, with a focus on the Prisma ORM integration.

## Overview

Our CI/CD pipeline automates the build, test, and deployment process for the Insurance Database application. It includes specific steps for handling Prisma ORM, ensuring proper schema validation and database connectivity.

## GitHub Actions Workflows

### Main Workflow (`.github/workflows/main.yml`)

The main workflow handles building, testing, and deploying the application:

1. **Trigger**: Runs on pushes to `main`, `feature/*`, and `release/*` branches, and on pull requests to `main`.

2. **Build Job**:
   - Checks out the code
   - Sets up Node.js
   - Installs dependencies
   - Generates Prisma Client
   - Runs linting
   - Builds the application
   - Runs tests (including Prisma-specific tests)
   - Caches build artifacts

3. **Deploy Job** (only on pushes to `main`):
   - Restores cached build artifacts
   - Validates database connection
   - Deploys the application

### Schema Validation Workflow (`.github/workflows/schema-validation.yml`)

This workflow validates the Prisma schema against the database:

1. **Trigger**: Runs weekly, on changes to schema-related files, and can be triggered manually.

2. **Validation Job**:
   - Validates the Prisma schema against the database
   - Checks for schema drift
   - Reports any discrepancies

## Environment Variables

The following environment variables must be configured as GitHub Secrets:

- `DATABASE_URL`: Connection string for the database
- `SUPABASE_URL`: URL for the Supabase instance
- `SUPABASE_ANON_KEY`: Anon key for Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for Supabase
- `OPENAI_API_KEY`: API key for OpenAI (if using vector embeddings)

## Workflow Details

### Prisma-Specific Steps

1. **Prisma Client Generation**:
   ```yaml
   - name: Generate Prisma Client
     run: npm run prisma:generate
   ```
   This step generates the Prisma Client based on the schema.

2. **Database Validation**:
   ```yaml
   - name: Validate database connection
     run: |
       # Script to validate database connection
       # ...
     env:
       DATABASE_URL: ${{ secrets.DATABASE_URL }}
   ```
   This step validates the database connection and schema.

3. **Schema Drift Check**:
   ```yaml
   - name: Check for Schema Drift
     run: |
       # Script to check for schema drift
       # ...
     env:
       DATABASE_URL: ${{ secrets.DATABASE_URL }}
   ```
   This step checks for differences between the Prisma schema and the database schema.

## Deployment Process

The deployment process follows these steps:

1. **Build and Test**: The application is built and tested in the CI pipeline.
2. **Validate Database**: The database connection is validated.
3. **Deploy**: The application is deployed to the target environment.
4. **Post-Deployment Validation**: The deployment is validated with health checks.

## Troubleshooting

### Common Issues

1. **Prisma Client Generation Failure**:
   - Check the `DATABASE_URL` environment variable
   - Verify the schema.prisma file is valid
   - Ensure the database is accessible from the CI environment

2. **Schema Drift**:
   - Run `npm run db:check-drift` locally to identify differences
   - Update the schema as needed
   - Regenerate the Prisma Client

3. **Deployment Failures**:
   - Check the logs for error messages
   - Verify environment variables are correctly set
   - Ensure the database is accessible from the deployment environment

## Maintenance

### Adding New Environment Variables

To add new environment variables:

1. Add them to `.env.example`
2. Add them to GitHub Secrets
3. Update the workflow files to use the new variables

### Updating the Workflow

To update the workflow:

1. Edit the workflow files in `.github/workflows/`
2. Test the changes locally if possible
3. Commit and push the changes
4. Monitor the workflow runs to ensure they work as expected

## Conclusion

This CI/CD pipeline ensures consistent and reliable builds, tests, and deployments of the Insurance Database application with Prisma ORM integration.
