
**Your Integration Pattern:**

*   **Database Querying & Modeling:** Prisma
*   **Authentication & RLS:** Supabase Auth SDK
*   **File Storage & Realtime:** Supabase SDK
*   **Backend Business Logic:** Your API/Serverless Functions using Prisma Client


## Prisma ORM Implementation Checklist (Enhanced for Supabase Integration)

**Project:** Insurance Database
**Goal:** Implement Prisma ORM for database querying and modeling, integrating smoothly with existing Supabase features (Auth, Storage, Realtime) and SQL migration workflow.

**Overall Strategy:** Migrate data access logic from direct `supabase-js` calls to Prisma Client within services and API layers. Maintain Supabase for Auth, RLS, Storage, and Realtime. Use existing SQL migrations (`supabase/migrations`) as the source of truth for schema changes, keeping `schema.prisma` synchronized via introspection (`prisma db pull`).

---

### **Phase 1: Initial Setup & Configuration (Est: 0.5 Day)**

**Goal:** Install Prisma, initialize the project, and configure basic environment settings.

1.  **Branch & Dependencies:**
    *   [X] Create a dedicated git branch (e.g., `feature/prisma-integration`).
    *   [X] Install Prisma CLI: `npm install prisma --save-dev`
    *   [X] Install Prisma Client: `npm install @prisma/client`
    *   [X] Verify installations (`package.json`, `node_modules`).

2.  **Prisma Initialization:**
    *   [X] Initialize Prisma: `npx prisma init` (Creates `prisma/schema.prisma` and updates `.env`).
    *   [X] Verify `prisma` directory and `schema.prisma` file creation.
    *   [X] Verify `.env` is updated with `DATABASE_URL` placeholder.

3.  **Environment Configuration:**
    *   [X] Update `.env` with the **direct** Supabase PostgreSQL connection string (not the pooler unless specifically needed and understood). Format: `DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/[DATABASE]?schema=public"`
    *   [X] Update `.env.example` with an anonymized `DATABASE_URL`.
    *   [X] Document `DATABASE_URL` requirement in `README.md`.

4.  **`.gitignore` Updates:**
    *   [X] Ensure `.env` and potentially `prisma/dev.db` (if using SQLite for local tests later) are in `.gitignore`.
    *   [X] Consider adding `*.prisma.snap` if using Jest snapshot testing with Prisma schema.

5.  **`package.json` Scripts:**
    *   [X] Add/Update Prisma scripts:
        ```json
        "scripts": {
          // ... existing scripts
          "prisma:pull": "prisma db pull",
          "prisma:generate": "prisma generate",
          "prisma:studio": "prisma studio",
          "prisma:format": "prisma format",
          "db:pull-generate": "npm run prisma:pull && npm run prisma:generate" // Convenience script
        }
        ```

6.  **Initial Connection Test:**
    *   [X] Run `npx prisma db pull` to perform the first introspection and verify the database connection. Address any connection errors.
    *   [X] Run `npx prisma format` to ensure initial schema formatting.

---

### **Phase 2: Schema Synchronization & Refinement (Est: 1-2 Days)**

**Goal:** Generate the initial Prisma schema from the existing Supabase database and refine it for optimal Prisma usage while respecting the SQL source of truth.

1.  **Database Introspection (Source of Truth: SQL Migrations):**
    *   [X] **Run `npx prisma db pull`**. This synchronizes `prisma/schema.prisma` with the current state defined by your `supabase/migrations/*.sql` files applied to the DB.
    *   [X] **Initial Review:** Compare the generated `schema.prisma` against your SQL files. Verify tables, columns, and basic types are present.

2.  **Schema Refinement (Manual Adjustments in `schema.prisma`):**
    *   [ ] **Map Names:** Add `@@map("table_name")` to models and `@map("column_name")` to fields to align Prisma's idiomatic naming (camelCase) with your database's likely snake_case naming. *Crucial step*.
        ```prisma
        model InsuranceCarrier {
          id        Int      @id @default(autoincrement())
          carrierName String   @map("carrier_name") // Map Prisma field to DB column
          // ... other fields
          @@map("insurance_carriers") // Map Prisma model to DB table
        }
        ```
    *   [ ] **Define Relations:** Manually add relation fields where introspection missed them or where you want explicit relations (e.g., one-to-many, many-to-many). Use `@relation` attribute. Ensure foreign keys exist in your SQL schema first.
    *   [ ] **Adjust Types:** Review and adjust types inferred by Prisma (e.g., `Json?` for `JSONB`, `DateTime?` for `timestamp`, correct enum types). Add native database types if needed (`@db.VarChar(100)`).
    *   [ ] **Define Enums:** If using PostgreSQL enums, define corresponding `enum` blocks in `schema.prisma` and map fields to them.
    *   [ ] **Add Constraints/Indexes (Verification):** Verify `@@unique`, `@unique`, `@@index` reflect SQL constraints. *Note: Add new constraints/indexes in your SQL migration files, apply them, then re-run `prisma db pull`.*
    *   [ ] **Remove Supabase Internal Tables:** Delete models for `auth.*`, `storage.*`, `pgsodium.*` etc., from `schema.prisma` unless you intend to query them directly via Prisma (unlikely given your pattern).
    *   [ ] **Add Comments:** Document models and fields within `schema.prisma` using `///`.

3.  **Generate Prisma Client:**
    *   [ ] **Run `npx prisma generate`**. This updates the type definitions in `node_modules/.prisma/client` based on your refined `schema.prisma`.
    *   [ ] **Verify Types:** Briefly inspect `node_modules/.prisma/client/index.d.ts` to ensure generated types look correct (e.g., model names, field names, relations).

4.  **Document Schema Workflow:**
    *   [X] Add a section to `docs/development/prisma-schema-workflow.md` clearly stating:
        *   SQL migrations (`supabase/migrations`) are the source of truth.
        *   **Workflow for Schema Changes:**
            1.  Modify/Create `.sql` migration file.
            2.  Apply migration to local DB (`supabase db reset` or `supabase migration up`).
            3.  Synchronize Prisma Schema: `npm run prisma:pull`.
            4.  Review changes in `schema.prisma` (add/adjust mappings/relations if needed).
            5.  Regenerate Prisma Client: `npm run prisma:generate`.
    *   [X] Update README.md with a link to the schema workflow documentation.
    *   [X] Document the Prisma implementation in CHANGELOG.md.

---

### **Phase 3: Prisma Client Setup & Integration (Est: 0.5 Day)**

**Goal:** Create a reusable Prisma Client instance and perform basic integration tests.

1.  **Singleton Client Instance:**
    *   [X] Create `src/lib/prisma.ts` (or similar location).
    *   [X] Implement the singleton pattern (as shown in your original checklist) to prevent multiple client instances in development.
    *   [X] Configure logging based on `NODE_ENV` (e.g., include `'query'` logs in development).
    *   [X] Add Prisma Client initialization error handling (try-catch).

2.  **Graceful Shutdown:**
    *   [X] In your main server file (`src/server.ts` or `src/api/app.ts`), add a shutdown hook to disconnect the client:
        ```typescript
        import { prisma } from './lib/prisma'; // Adjust path

        async function gracefulShutdown() {
          console.log('Shutting down gracefully...');
          await prisma.$disconnect();
          console.log('Prisma Client disconnected.');
          process.exit(0);
        }
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);
        ```

3.  **Basic Integration Testing:**
    *   [ ] Create a simple test script (`tests/integration/prisma.test.ts` or similar).
    *   [ ] Import the singleton `prisma` instance.
    *   [ ] Write a test to perform a basic `findFirst` or `findUnique` query on one model.
    *   [ ] Write a test to perform a basic `create` and `delete` operation (ensure cleanup).
    *   [ ] Write a test to query a model including a relation (`include: { relatedModel: true }`).
    *   [ ] Verify tests run successfully against your local test database.

---

### **Phase 4: Service Layer Migration (Est: 3-5 Days)**

**Goal:** Refactor existing services (or create new ones) to use Prisma Client for data access, replacing direct `supabase-js` calls.

*For each relevant service (e.g., `CarrierService`, `DocumentImportService`, `GuidelineService`, `ProcedureService`):*

1.  **Identify Data Access:** Locate all methods currently using `supabase.from(...)`, `supabase.rpc(...)`, etc., for database operations targeted for Prisma migration.
2.  **Method-by-Method Refactoring (CarrierService):**
    *   [X] **Choose a Method:** Start with a simple query method (e.g., `getCarrierById`).
    *   [X] **Translate Query:** Rewrite the Supabase query using Prisma Client syntax (e.g., `prisma.insuranceCarrier.findUnique(...)`). Use `include` for relations instead of manual joins.
    *   [X] **Update Types:** Change function signatures and return types to use Prisma's generated types (e.g., `Prisma.PromiseReturnType<typeof prisma.insuranceCarrier.findUnique>`).
    *   [X] **Handle Errors:** Adapt error handling for Prisma-specific errors (`PrismaClientKnownRequestError`, etc.).
    *   [X] **Refactor Complex Logic:** For pagination, sorting, and database operations. Implemented listCarriers, searchCarriers, and getCarrierById.
    *   [ ] **Vector Search:** For semantic search (`GuidelineService`), use `prisma.$queryRaw` or `prisma.$executeRaw` to call your PostgreSQL `match_guidelines` or similar functions, passing the embedding vector. Map the raw results back to typed objects.
3.  **Unit Testing:**
    *   [X] Write unit tests for *each refactored method* in CarrierService.
    *   [X] Mock the Prisma Client instance (using `jest.mock`) to isolate service logic.
4.  **Performance Comparison (Key Methods):**
    *   [ ] Before deleting the old Supabase client code for a *critical* query, benchmark its performance.
    *   [ ] Benchmark the new Prisma version of the same query.
    *   [ ] Document any significant differences (positive or negative). Address regressions in the Optimization phase.
5.  **Documentation:**
    *   [X] Add comprehensive JSDoc/TSDoc comments for all refactored methods in PrismaCarrierService.
    *   [X] Update Prisma migration progress documentation to track completed work.

---

### **Phase 5: API Layer Updates (Est: 2-3 Days)**

**Goal:** Update controllers and middleware to interact with the Prisma-powered services and handle Prisma-specific considerations.

1.  **Controller Updates:**
    *   *For each controller using a migrated service:*
        *   [X] Update service calls to use the new/refactored Prisma-based methods (Created PrismaCarrierController).
        *   [X] Adjust data transformation logic for the structure returned by the Prisma service.
        *   [X] Verify response formatting and error handling.
2.  **Middleware Updates:**
    *   [ ] **Authentication (`src/api/middleware/auth.ts`):** Likely *no changes* needed as it uses Supabase Auth. Verify it still functions correctly.
    *   [ ] **Validation (`src/api/middleware/validation.ts`, `carrier.validation.ts`):** Review input validation schemas (Zod/express-validator). Update them if Prisma's stricter typing or refined data models necessitate changes in expected input shapes.
    *   [ ] **Error Handling (`src/api/middleware/error.ts`):**
        *   Add specific handling for `Prisma.PrismaClientKnownRequestError`. Check `error.code` for common issues (e.g., `P2002`: Unique constraint violation, `P2025`: Record not found) and map them to appropriate HTTP status codes (409/400, 404).
        *   Handle `Prisma.PrismaClientValidationError` (e.g., map to 400 Bad Request).
        *   Ensure generic Prisma errors are caught and mapped to 500 Internal Server Error.
    *   [ ] **Monitoring/Audit (`src/api/middleware/monitoring.ts`):** Ensure this middleware still correctly captures necessary info even with Prisma service calls. No major changes expected unless request context structure changed significantly.
    *   [ ] **Caching (`src/middleware/cache.ts`):** Verify cache keys and invalidation logic still work correctly with data structures potentially returned by Prisma services.

3.  **Integration Testing (API Level):**
    *   [X] Set up new API routes for testing Prisma implementation (`/api/prisma/carriers/`).
    *   [ ] Re-run existing API integration tests (`tests/integration`). Update tests that fail due to changed response structures or error handling.
    *   [ ] Add new integration tests specifically targeting endpoints heavily reliant on Prisma (e.g., complex relation queries, transaction-based imports).

---

### **Phase 6: Testing & Validation (Ongoing throughout, Dedicated Focus: 2-3 Days)**

**Goal:** Ensure comprehensive testing coverage for the new Prisma implementation.

1.  **Unit Testing:**
    *   [ ] Ensure all migrated service methods have unit tests with Prisma Client mocked.
    *   [ ] Achieve target code coverage for service layer.
    *   [ ] Test edge cases and error handling specifically for Prisma interactions.
2.  **Integration Testing:**
    *   [ ] **Test Database Setup:** Ensure a reliable process for setting up and tearing down a dedicated test database (`tests/integration/setup.ts`). Use Supabase CLI (`supabase db reset`) or direct PG commands.
    *   [ ] Test API endpoints end-to-end, connecting to the test database with Prisma.
    *   [ ] Test scenarios involving relations (`include`), transactions (`$transaction`), and raw queries (`$queryRaw` for vector search).
    *   [ ] Validate data integrity constraints via API actions that should trigger them.
3.  **Schema Synchronization Testing:**
    *   [ ] Manually test the schema change workflow: Make a small SQL change -> Apply migration -> `prisma db pull` -> `prisma generate` -> Verify client types update.

---

### **Phase 7: Performance Optimization (Est: 1-2 Days)**

**Goal:** Analyze and optimize Prisma query performance.

1.  **Query Analysis:**
    *   [ ] Enable Prisma query logging in development (`log: ['query', 'info', 'warn', 'error']`).
    *   [ ] Analyze generated SQL queries for key operations identified during service migration benchmarking.
    *   [ ] Use `EXPLAIN ANALYZE` directly in Supabase SQL editor for complex Prisma-generated queries.
2.  **Optimization Techniques:**
    *   [ ] **Indexing:** Identify slow queries and add necessary indexes *in your SQL migration files*. Re-run `prisma db pull` after applying.
    *   [ ] **Select/Include:** Use `select` to fetch only necessary fields. Be mindful of deeply nested `include` statements; fetch related data separately if needed.
    *   [ ] **Pagination:** Ensure all list endpoints use Prisma's `skip` and `take` for pagination. Consider cursor-based pagination (`cursor`, `take`, `skip: 1`) for very large datasets.
    *   [ ] **Batching:** Use `prisma.$transaction` for bulk inserts/updates where appropriate (already addressed in `DocumentImportService`).
    *   [ ] **Raw Queries:** For highly complex queries or vector search where Prisma's ORM is inefficient, continue using `prisma.$queryRaw` or `prisma.$executeRaw`, ensuring proper parameterization.
3.  **Caching:**
    *   [ ] Review existing Redis caching (`src/services/redis.service.ts`, `src/middleware/cache.ts`).
    *   [ ] Ensure cache keys are appropriate for Prisma query results.
    *   [ ] Implement or verify cache invalidation strategies when data is modified via Prisma.

---

### **Phase 8: Documentation & Knowledge Transfer (Est: 1 Day)**

**Goal:** Update all project documentation to reflect Prisma usage.

1.  **Code Documentation:**
    *   [X] Update JSDoc/TSDoc comments for services/methods using Prisma Client.
    *   [ ] Add comments in `schema.prisma`.
2.  **READMEs/Guides:**
    *   [ ] Update `README.md` and any development guides (`docs/*.md`).
    *   [ ] **Crucially:** Document the decided Schema Management Workflow (SQL -> `db pull` -> `generate`).
    *   [ ] Document the Prisma + Supabase integration pattern (what each tool is used for).
    *   [ ] Add a Prisma "Cookbook" section in docs with examples of common queries specific to this project.
3.  **API Documentation:**
    *   [ ] Update OpenAPI spec (`src/api/openapi.yaml`) if response structures changed. Add Prisma-specific error codes if relevant.

---

### **Phase 9: Deployment & CI/CD Updates (Est: 0.5 Day)**

**Goal:** Integrate Prisma's build steps into CI/CD pipelines.

1.  **CI Pipeline (`.github/workflows` or similar):**
    *   [ ] **Build Step:** Ensure `npm run prisma:generate` is run *after* `npm install` and *before* the TypeScript build (`npm run build`).
    *   [ ] **Linting/Testing:** Ensure linters and tests run against the Prisma-integrated code.
    *   [ ] **Database Checks:** Add a step to connect to a test DB (if feasible in CI) and potentially run `prisma db pull` to detect schema drift (optional but recommended).
2.  **Deployment Process:**
    *   [ ] **Environment Variables:** Ensure `DATABASE_URL` is correctly configured in production/staging environments.
    *   [ ] **Build Artifact:** Confirm the production build artifact includes the generated Prisma Client (`node_modules/.prisma/client`).
    *   [ ] **Database Migrations:** **Reiterate:** Database schema changes are deployed using your *existing* Supabase SQL migration process (`supabase migration up` or similar), *not* `prisma migrate deploy`.
    *   [ ] **Post-Deployment:** After DB migration, the deployed application instance needs the latest Prisma Client (which should be part of the build).

---

### **Phase 10: Specific Functionality Implementation (Est: Varies based on feature complexity)**

**Goal:** Ensure core application features function correctly using the newly integrated Prisma services. Migrate any remaining feature-specific data access logic.

1.  **Advanced Search Features:**
    *   [ ] **Fuzzy Name Matching:** Review/Implement carrier name fuzzy matching. If using database functions (like trigrams via `pg_trgm`), ensure they are called correctly using `prisma.$queryRaw`. If implementing in application logic, use Prisma to fetch potential candidates first.
    *   [ ] **Full-Text Search:** Verify existing PostgreSQL full-text search indexes are utilized via Prisma, possibly using raw queries (`$queryRaw`) or specific Prisma full-text search capabilities if applicable to your version/preview features.
    *   [ ] **Procedure Code Search:** Ensure procedure code searches (including wildcards if needed) are efficient using Prisma (`contains`, `startsWith`, `endsWith` or `$queryRaw` for more complex patterns).
    *   [ ] **Carrier Hierarchy Search:** Implement queries using Prisma's relation features (`include` nested relations) or potentially recursive Common Table Expressions (CTEs) via `$queryRaw` if your hierarchy requires it.
    *   [ ] **Document Content Search:** Verify full-text or vector search on document/page content functions correctly via Prisma.
    *   [ ] **Combined Search:** Refactor logic combining search across multiple entities (Carriers, Procedures, Guidelines) to use Prisma queries, potentially combining results in the application layer or using more complex Prisma queries if feasible.
    *   [ ] **Relevance Scoring:** Ensure relevance scoring logic works with data structures returned by Prisma queries.
    *   [ ] **Highlighting/Suggestions:** Verify these features integrate correctly with Prisma search results.
    *   [ ] **Testing:** Create/update tests specifically for these advanced search features using the Prisma data layer.
    *   [ ] **Documentation:** Update documentation for search APIs, noting any changes due to Prisma implementation.

2.  **Data Import and Export:**
    *   [ ] **JSON Import:** Review the `DocumentImportService` (or similar) migration. Ensure Prisma Transactions (`prisma.$transaction([...])`) are correctly used for atomic imports of documents, pages, and procedures. Verify error handling and rollback within transactions.
    *   [ ] **CSV Import:** If CSV imports directly interact with the database (beyond just parsing), migrate that logic to use Prisma, potentially using `$transaction` for batch inserts/upserts.
    *   [ ] **Batch Processing:** Confirm efficiency of batch inserts/upserts using Prisma (`createMany`, `updateMany`, or transactions). Test with large datasets.
    *   [ ] **Data Validation:** Ensure validation logic (e.g., checking for existing records before import) uses efficient Prisma queries (`findUnique`, `findFirst`).
    *   [ ] **Export Functionality:** If data export features exist, refactor them to fetch data using Prisma Client, ensuring efficient retrieval of potentially large datasets (pagination, streaming).
    *   [ ] **Testing:** Add/update tests for import/export workflows with Prisma.
    *   [ ] **Documentation:** Update import/export workflow documentation.

3.  **Relationships and Hierarchies:**
    *   [ ] **Hierarchy Implementation:** Verify network-carrier-plan (or other) hierarchies are correctly modeled in `schema.prisma` with appropriate relations.
    *   [ ] **Hierarchy Queries:** Implement or refactor queries fetching hierarchical data using Prisma's nested `include` or `select`.
    *   [ ] **Recursive Queries:** If needed, implement recursive CTEs using `prisma.$queryRawUnsafe` (use with caution, ensure parameterization where possible) or fetch data iteratively using Prisma if recursion depth is limited.
    *   [ ] **Tree Manipulation:** If the application modifies hierarchical structures, ensure these operations use Prisma correctly (e.g., updating parent IDs).
    *   [ ] **Validation:** Add validation logic using Prisma queries to ensure hierarchical integrity (e.g., prevent circular dependencies if applicable).
    *   [ ] **Testing:** Create tests for querying and manipulating complex hierarchies.
    *   [ ] **Benchmarking:** Benchmark performance of deep relation queries via Prisma and optimize if necessary.

---

### **Phase 11: Final Integration and Rollout (Est: 1-2 Sprints, depending on strategy)**

**Goal:** Safely deploy the Prisma-integrated application, monitor its stability and performance, and fully transition away from the old data access methods.

1.  **Parallel Running / Feature Flagging (Optional but Recommended):**
    *   [ ] **Implement Feature Flags:** Introduce flags (e.g., using environment variables or a feature flag service) to toggle between old (supabase-js) and new (Prisma) data access layers for specific services or endpoints.
    *   [ ] **Compatibility Layer:** If necessary, create a temporary layer to abstract data access, allowing the flag to switch implementations underneath.
    *   [ ] **Deploy Feature Flags:** Deploy the code with the ability to switch implementations. Start with Prisma disabled or enabled only for specific internal users/traffic percentage.
    *   [ ] **Monitoring Setup:** Ensure monitoring (logs, metrics, error tracking) captures data for *both* implementations, tagged appropriately.
    *   [ ] **Performance Comparison:** Collect performance data (latency, throughput, error rates) for both implementations under real traffic (if possible) or realistic load tests.
    *   [ ] **Validation:** Compare results from both implementations to ensure consistency. Document and resolve any discrepancies.
    *   [ ] **Gradual Rollout:** Gradually increase traffic to the Prisma implementation, monitoring closely.
    *   [ ] **Rollback Plan:** Define clear conditions under which you would roll back to the old implementation via the feature flag.

2.  **Cutover Planning:**
    *   [ ] **Final Validation:** Perform final end-to-end testing of the Prisma implementation in a staging environment mirroring production.
    *   [ ] **Performance Verification:** Confirm performance meets requirements under simulated production load.
    *   [ ] **Create Cutover Checklist:** Detail all steps required for the switch (e.g., final deployment, feature flag enablement, monitoring checks).
    *   [ ] **Schedule Cutover:** Choose a low-traffic window if a hard cutover (without feature flags) is planned.
    *   [ ] **Backup Strategy:** Ensure a reliable database backup exists immediately before the cutover.
    *   [ ] **Communication Plan:** Inform stakeholders (team, users if applicable) about the planned cutover window and potential impact.
    *   [ ] **Monitoring Plan:** Define key metrics to watch immediately post-cutover.
    *   [ ] **Rollback Procedure (Hard Cutover):** Document steps to revert the deployment if major issues arise.

3.  **Execution & Monitoring:**
    *   [ ] Execute the cutover plan (deploy final code, enable Prisma feature flag fully, or perform deployment swap).
    *   [ ] Closely monitor application logs, error rates, database performance, and API latency.
    *   [ ] Run post-cutover validation scripts/checks to confirm core functionality.

4.  **Post-Implementation Cleanup:**
    *   [ ] **Remove Feature Flags:** Once stability is confirmed (e.g., after 1-2 weeks), remove the feature flags and associated compatibility layers.
    *   [ ] **Remove Legacy Code:** Delete the old data access code (supabase-js service implementations).
    *   [ ] **Update Documentation:** Ensure all documentation (READMEs, development guides, API docs) fully reflects the exclusive use of Prisma.
    *   [ ] **Knowledge Sharing:** Conduct a session with the team to review the migration, lessons learned, and Prisma best practices.
    *   [ ] **Performance Review:** Analyze post-migration performance metrics compared to pre-migration benchmarks. Document improvements or any new bottlenecks.
    *   [ ] **Update Standards:** Update team coding standards to mandate Prisma usage for database interactions.

---

### **Phase 12: RAG Integration Updates (Post-Prisma Core)**

**Goal:** Ensure RAG features work correctly with Prisma.

1.  **Vector Fields:** Handled during Schema Synchronization (Phase 2) - ensure `vector(1536)` type is correctly mapped or handled.
2.  **Embedding Generation Service (`src/utils/embeddings.ts`, `EmbeddingManager.ts`):** Review if this service needs to interact with Prisma (e.g., fetching content to embed). If so, migrate its DB calls.
3.  **Vector Search Implementation (`src/services/vector-index.service.ts`):**
    *   [ ] Confirm how vector search queries are executed. Likely using `prisma.$queryRaw` or `prisma.$executeRaw` to call `pgvector` functions like `<=>`.
    *   [ ] Ensure raw query results are correctly mapped to application types.
    *   [ ] Optimize raw vector queries if necessary.

---
