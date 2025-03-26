#!/bin/bash

# Navigate to project root
cd "$(dirname "$0")/.."

# Build and start containers
docker-compose up --build -d

# Wait for database to be ready
echo "Waiting for database to be ready..."
until docker-compose exec db pg_isready -U postgres -d insurance_db; do
    sleep 2
done

echo "Database is ready!"
echo "Supabase Studio: http://localhost:3000"
echo "PostgreSQL: postgresql://postgres:postgres@localhost:5432/insurance_db"
echo "Postgres Meta: http://localhost:8080" 