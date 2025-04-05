# CI/CD Setup for Insurance Database

This document provides instructions for setting up the CI/CD environment for the Insurance Database project.

## GitHub Actions Workflow

The project uses GitHub Actions for continuous integration and deployment. The workflow includes:

1. **Schema Validation**: Validates the Prisma schema against the database
2. **Database Initialization**: Ensures the database is properly set up for CI/CD
3. **Testing**: Runs unit and integration tests
4. **Deployment**: Deploys the application to the target environment

## Required Secrets

The following secrets must be set up in your GitHub repository settings:

| Secret Name | Description |
|-------------|-------------|
| `DATABASE_URL` | PostgreSQL connection string for the CI/CD database |

### Setting up the DATABASE_URL Secret

1. Go to your repository on GitHub
2. Navigate to Settings > Secrets and variables > Actions
3. Click "New repository secret"
4. Name: `DATABASE_URL`
5. Value: `postgresql://username:password@hostname:port/database?schema=public`

## Database Requirements

The CI/CD database must meet the following requirements:

1. PostgreSQL 13 or higher
2. Vector extension installed (for vector search functionality)
3. The database user must have permissions to:
   - Create and modify tables
   - Create extensions (or the vector extension must be pre-installed)
   - Execute SQL functions

### Setting up a CI/CD Database

#### Option 1: Local PostgreSQL (for testing)

```bash
# Install PostgreSQL and vector extension
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo apt-get install postgresql-13-vector

# Create database and user
sudo -u postgres psql
postgres=# CREATE USER cicd WITH PASSWORD 'your_password';
postgres=# CREATE DATABASE insurance_db_test;
postgres=# GRANT ALL PRIVILEGES ON DATABASE insurance_db_test TO cicd;
postgres=# \c insurance_db_test
insurance_db_test=# CREATE EXTENSION vector;
```

#### Option 2: Supabase (recommended for CI/CD)

1. Create a new Supabase project
2. Enable the vector extension in the SQL editor:
   ```sql
   CREATE EXTENSION vector;
   ```
3. Get the connection string from the Supabase dashboard
4. Add the connection string as the `DATABASE_URL` secret in GitHub

## Troubleshooting

### Common Issues

1. **Schema Validation Fails**:
   - Ensure the `DATABASE_URL` secret is correctly set
   - Verify that the database exists and is accessible
   - Check that the vector extension is installed

2. **Vector Extension Not Available**:
   - Ensure you're using PostgreSQL 13 or higher
   - Install the vector extension manually if needed

3. **Permission Issues**:
   - Ensure the database user has the necessary permissions
   - For Supabase, use the default postgres user which has all required permissions

### Debugging

The CI/CD workflow includes detailed logging. If you encounter issues:

1. Check the GitHub Actions logs for error messages
2. Run the database initialization script locally to test:
   ```bash
   DATABASE_URL=your_connection_string node scripts/ci-db-init.js
   ```
3. Verify that the Prisma schema matches the database schema:
   ```bash
   npx prisma db pull
   ```

## Updating the Workflow

If you need to update the CI/CD workflow:

1. Modify the workflow files in `.github/workflows/`
2. Update the database initialization script in `scripts/ci-db-init.js`
3. Test the changes locally before pushing to GitHub
