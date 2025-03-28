# Changelog

All notable changes to the Insurance Database project will be documented in this file.

## [Unreleased]

### Added
- Prisma ORM implementation (Phase 1-5 completed):
  - Phase 1: Initial setup and configuration
  - Phase 2: Schema synchronization and refinement
  - Phase 3: Prisma Client setup and integration
  - Phase 4: Service Layer Migration (CarrierService, ProcedureService, GuidelineService)
  - Phase 5: API Layer Updates with controllers and middleware
- Parallel API endpoints for Prisma testing at /api/prisma/*
- Vector search implementation using Prisma $queryRaw
- Prisma-specific error handling middleware with appropriate HTTP status codes

### Changed
- Updated project structure to include Prisma services and controllers
- Enhanced error handling with Prisma-specific error types
- Improved API response consistency between Supabase and Prisma implementations

## [0.3.0] - 2025-02-10

### Added
- Vector search functionality for guidelines using pgvector
- Hybrid search algorithms combining text and vector search
- Reciprocal Rank Fusion (RRF) algorithm for better search results
- Redis caching for search operations
- OpenAI integration for embedding generation

### Changed
- Optimized search algorithms for better performance
- Improved error handling and logging

## [0.2.0] - 2025-01-15

### Added
- Procedure requirements functionality
- Documentation requirements for procedures
- Carrier-specific guidelines
- Search functionality for carriers and procedures
- PostgreSQL full-text search implementation

### Changed
- Enhanced database schema with proper relations
- Improved API response structure for consistency

## [0.1.0] - 2025-01-01

### Added
- Initial project setup
- Basic database structure
- Carrier management functionality
- Procedure management functionality
- Guidelines management functionality
- Authentication and authorization using Supabase
- Basic API endpoints
