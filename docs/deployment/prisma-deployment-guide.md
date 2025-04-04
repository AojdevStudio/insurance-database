# Prisma Deployment Guide

This guide provides comprehensive instructions for deploying applications that use Prisma ORM, specifically for the Insurance Database project.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Build Process](#build-process)
4. [Deployment Process](#deployment-process)
5. [Monitoring and Validation](#monitoring-and-validation)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying, ensure you have:

- Node.js 18+ installed
- Access to the production/staging database
- Necessary environment variables
- Proper permissions for the deployment environment

## Environment Setup

### Required Environment Variables

The following environment variables must be set in your deployment environment:

```
DATABASE_URL=postgresql://username:password@hostname:port/database
NODE_ENV=production
```

For local development, copy `.env.example` to `.env` and update the values.

### Database URL Format

The `DATABASE_URL` should follow this format:

```
postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
```

- For Supabase: `postgresql://postgres:PASSWORD@db.PROJECTREF.supabase.co:5432/postgres`
- For local development: `postgresql://postgres:postgres@localhost:5432/insurance_db`

### Environment Variable Security

- Never commit `.env` files to version control
- Use GitHub Secrets or equivalent for CI/CD pipelines
- Rotate database credentials regularly

## Build Process

The build process for Prisma applications requires these steps in order:

1. Install dependencies
2. Generate Prisma Client
3. Build TypeScript code

```bash
# Install dependencies
npm ci

# Generate Prisma Client
npm run prisma:generate

# Build the application
npm run build
```

### CI/CD Integration

Our GitHub Actions workflow automates this process:

- `.github/workflows/main.yml` - Main CI/CD pipeline
- `.github/workflows/schema-validation.yml` - Schema validation checks

## Deployment Process

### Pre-Deployment Checks

Before deploying:

1. Ensure all tests pass: `npm test`
2. Validate database connection: `npm run db:validate`
3. Check for schema drift: Compare local schema with database schema

### Deployment Steps

1. **Prepare the Environment**
   - Set up all required environment variables
   - Ensure database is accessible from the deployment environment

2. **Deploy the Application**
   - Deploy the built application (`dist` directory)
   - Ensure `node_modules/.prisma` is included in the deployment

3. **Post-Deployment Validation**
   - Verify the application can connect to the database
   - Run health checks to ensure all functionality works

### Rollback Procedure

If deployment fails:

1. Revert to the previous version
2. Check database connection and logs
3. Verify environment variables are correct

## Monitoring and Validation

### Schema Validation

We use automated schema validation to detect drift:

- Weekly scheduled checks
- Checks on schema-related file changes
- Manual triggering via GitHub Actions

### Performance Monitoring

Monitor database performance:

- Query execution times
- Connection pool usage
- Error rates

## Troubleshooting

### Common Issues

1. **Prisma Client Generation Failure**
   - Ensure `DATABASE_URL` is correct
   - Check for syntax errors in `schema.prisma`
   - Verify database permissions

2. **Database Connection Issues**
   - Check network connectivity
   - Verify credentials and connection string
   - Ensure firewall rules allow connections

3. **Schema Drift**
   - Run `prisma db pull` to update schema
   - Compare with committed schema
   - Update as needed and regenerate client

### Getting Help

For assistance:

- Check Prisma documentation: https://www.prisma.io/docs/
- Review project-specific documentation in `docs/development/`
- Contact the development team

## Conclusion

Following this deployment guide ensures consistent and reliable deployments of the Insurance Database application with Prisma ORM integration.
