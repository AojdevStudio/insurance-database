# Use PostgreSQL 15 as the base image
FROM postgres:15

# Install build dependencies for vector extension
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    postgresql-server-dev-15 \
    && rm -rf /var/lib/apt/lists/*

# Install pgvector extension
RUN git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git \
    && cd pgvector \
    && make \
    && make install \
    && cd .. \
    && rm -rf pgvector

# Copy initialization scripts
COPY ./init.sql /docker-entrypoint-initdb.d/

# Set environment variables
ENV POSTGRES_DB=insurance_db
ENV POSTGRES_USER=postgres
ENV POSTGRES_PASSWORD=postgres

# Expose PostgreSQL port
EXPOSE 5432

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD pg_isready -U postgres -d insurance_db || exit 1 