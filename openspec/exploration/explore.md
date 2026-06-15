## Exploration: Docker Setup + Features for Commit Count

### Current State

- **26 commits** on the project (NestJS 11 + TypeScript + PostgreSQL + Stellar/Soroban)
- **docker-compose.yml**: Only has Postgres 16-alpine service with healthcheck and named volume
- **No Dockerfile**: Does NOT exist
- **No .dockerignore**: Does NOT exist
- **10 modules** registered: assets, auth, config, dashboard, database, indexer, marketplace, payments, tokens, wallet
- **Tests exist ONLY in auth module**: 4 spec files + 2 e2e tests (all auth-related)
- **Docker setup**: Only Postgres; the API cannot run via Docker today
- **Openspec**: SDD initialized, has wallet-auth spec and token-marketplace change in progress
- **README**: Still the default NestJS starter template — completely generic

### Codebase Health Findings

**Bugs found during exploration:**
1. `test/app.e2e-spec.ts` tests `GET /` expecting "Hello World!" — but `setupApp()` sets global prefix `/api`, so `/` returns 404. **Test is broken.**
2. `src/config/soroban.config.ts` is **dead code** — AppModule imports from `src/tokens/config/soroban.config.ts` instead. The file in `src/config/` is never imported.
3. `src/marketplace/dto/` and `src/dashboard/dto/` are **empty directories** — DTOs are defined inline in service files (anti-pattern for a growing codebase).
4. `MockPaymentAdapter` is defined but **not registered** in `PaymentsModule`.
5. `JWT_SECRET` is **missing from `.env.example`** — it falls back to `'dev-secret'` which is insecure.
6. `soroban.config.ts` in `src/tokens/config/` uses empty string `''` as fallback while `src/config/soroban.config.ts` uses `'CONTRACT_ID_PLACEHOLDER...'` — inconsistency.

### Module-by-Module Test Coverage

| Module | Controllers | Services | Spec Files | E2E | State |
|--------|-------------|----------|------------|-----|-------|
| **auth** | ✅ | ✅ | 4 (controller, service, repo, store) | 2 (auth, app-broken) | **Only tested module** |
| **assets** | ❌ | ❌ | 0 | 0 | No tests |
| **dashboard** | ❌ | ❌ | 0 | 0 | No tests, DTOs in service |
| **marketplace** | ❌ | ❌ | 0 | 0 | No tests, DTOs in service |
| **wallet** | ❌ | ❌ | 0 | 0 | No tests |
| **payments** | ❌ | ❌ | 0 | 0 | No tests, MockAdapter unused |
| **indexer** | ❌(no controller) | ❌ | 0 | 0 | No tests |
| **tokens** | ❌(no controller) | ❌ | 0 | 0 | No tests |
| **config** | N/A | N/A | 0 | 0 | No tests |
| **database** | N/A | N/A | 0 | 0 | No tests for seed/config |

### Commit Plan (26 → 70 = **44 new commits**)

---

## Phase 1: Docker Setup (3 commits)

**Branch: `feature/docker-setup`**

### Commit 1 — Dockerfile: multi-stage build
- **Base**: `node:22-alpine` (current tsconfig targets ES2023, works with Node 22)
- **Stage 1 (build)**: Install deps, run build
- **Stage 2 (production)**: Copy only `dist/`, `node_modules/` (prod-only), `package.json`
- User = `node` (non-root, UID 1000)
- `EXPOSE 3000`
- `CMD ["node", "dist/main"]`

### Commit 2 — docker-compose.yml: add api service
- Add `api` service:
  - `build: .`
  - `depends_on: postgres` with `condition: service_healthy`
  - Environment variables from `.env` file
  - Port mapping `3000:3000`
- Postgres healthcheck already exists (good)

### Commit 3 — Entrypoint script, .dockerignore, health endpoint
- **`entrypoint.sh`**: Wait-for-it logic for Postgres (poll `pg_isready`), then `node dist/main`
- **`.dockerignore`**: node_modules, dist, .git, coverage, .env (not .env.example)
- **Health endpoint**: `GET /api/health` returning `{ status: 'ok', timestamp, uptime }`

**Risks:**
- Seed on startup (`main.ts` calls `seedDatabase`) + DB not ready → entrypoint must wait for Postgres **before** launching Node
- `DB_SYNCHRONIZE=true` in .env.example means TypeORM auto-creates tables every startup (fine for dev, risky for prod)

---

## Phase 2: Test Coverage — Unit Specs (8 commits)

**Branch: `feature/test-coverage-unit`**

Each module gets its own commit with meaningful test setup:

### Commit 4 — AssetsController spec
- Test: `GET /api/assets` returns paginated list
- Test: `GET /api/assets/types` returns asset types
- Test: `GET /api/assets/:id` returns 404 for not found
- Test: `POST /api/assets` creates asset (validation)

### Commit 5 — AssetsService spec
- Mock all 6 repositories
- Test: `create()` generates unique slugs
- Test: `findById()` throws NotFoundException
- Test: `findPublished()` paginates correctly
- Test: `getTags()` returns sorted tags

### Commit 6 — WalletController + WalletService specs
- Mock walletRepo, pkgRepo, txRepo
- Test: `getBalance()` creates wallet if not exists
- Test: `purchasePackage()` rejects insufficient balance
- Test: `getTransactions()` paginates
- Test: `getPackages()` returns sorted packages

### Commit 7 — DashboardService + MarketplaceService specs
- Dashboard: metrics aggregation, top assets, activity logs
- Marketplace: search with ILIKE, featured/trending, categories

### Commit 8 — PaymentsService + Adapter specs
- Test: PaymentsService delegates to correct adapter
- Test: StripeAdapter, PayPalAdapter, MockPaymentAdapter (each isolated)
- Test: Error handling when adapter is not configured

### Commit 9 — IndexerService spec
- Test: `recordTransaction()` creates and saves
- Test: `queryTransactions()` with wallet/date/offset filters
- Test: `getTotalConsumed()` SUM aggregation

### Commit 10 — TokensService spec
- Mock StellarSdk.rpc.Server
- Test: `mintTokens()` handles unconfigured contract ID gracefully
- Test: `onModuleInit()` connects to RPC

### Commit 11 — Config setup spec + Seed spec
- Test: `setupApp()` applies global prefix, validation, CORS, helmet
- Test: `setupCors()` with wildcard and specific origins
- Test: `seedDatabase()` is idempotent (skips if data exists)

---

## Phase 3: Infrastructure & DX (5 commits)

**Branch: `feature/infrastructure-dx`**

### Commit 12 — Swagger/OpenAPI setup
- Add `@nestjs/swagger` dependency
- Configure SwaggerModule in `main.ts` (title: "AgentVerse API", version, bearer auth)
- Will add per-endpoint decorators in Phase 4

### Commit 13 — Makefile
- Targets: `build`, `test`, `test:cov`, `lint`, `format`, `docker-up`, `docker-down`, `docker-build`, `clean`, `migration:run`, `migration:create`

### Commit 14 — CI/CD (GitHub Actions)
- `.github/workflows/ci.yml`:
  - Trigger: push to main, PRs
  - Jobs: lint → test → build
  - PostgreSQL service container for tests

### Commit 15 — Environment validation
- Use `@nestjs/config` Joi validation schema
- Validate: `DB_*`, `STELLAR_*`, `JWT_SECRET`, `PORT`, `STRIPE_API_KEY`, `PAYPAL_*`
- Fail fast on startup if required vars missing

### Commit 16 — README rewrite
- Replace default NestJS README with project-specific:
  - Project description (AgentVerse API)
  - Tech stack
  - Prerequisites (Docker, Node 22)
  - Quick start (`docker compose up`)
  - Development setup (local)
  - Available scripts (from Makefile)

---

## Phase 4: Production Hardening (6 commits)

**Branch: `feature/production-hardening`**

### Commit 17 — Global exception filter
- `HttpExceptionFilter` catches all exceptions
- Standardized error JSON: `{ statusCode, message, error, timestamp, path }`
- Logs errors with request context

### Commit 18 — Request logging interceptor
- `LoggingInterceptor` logs method, URL, status code, duration
- Excludes health endpoint from logging

### Commit 19 — Response interceptor
- `ResponseInterceptor` wraps all successful responses in `{ data, meta }` format
- Adds `timestamp` and `requestId` to every response

### Commit 20 — Rate limiting
- Add `@nestjs/throttler` package
- Global guard: 100 requests per 60 seconds
- Bypass rate limit for health endpoint

### Commit 21 — Compression + Helmet tuning
- Add `compression` middleware
- Tune helmet CSP for API (already relaxed, but document why)
- Move CORS allowed origins to env var `CORS_ORIGINS`

### Commit 22 — Graceful shutdown + Request ID
- Listen to `SIGTERM`/`SIGINT`, close Nest app gracefully
- Generate `X-Request-Id` header on every request (via middleware or interceptor)
- Include requestId in logs and error responses

---

## Phase 5: Cleanup & Bugfixes (5 commits)

**Branch: `fix/cleanup-dead-code`**

### Commit 23 — Fix app.e2e-spec.ts
- Update `GET /` test to `GET /api/health` (will be created) or remove the broken test

### Commit 24 — Remove duplicate soroban.config.ts
- Delete `src/config/soroban.config.ts` (dead code)
- Confirm only `src/tokens/config/soroban.config.ts` is used

### Commit 25 — Register MockPaymentAdapter
- Add `MockPaymentAdapter` to `PaymentsModule` providers
- Add env var `MOCK_PAYMENT_ENABLED` (already read by adapter)

### Commit 26 — Extract DTOs from service files
- Move `MarketplaceItemDto` to `src/marketplace/dto/`
- Move dashboard interfaces (`DashboardMetricsDto`, `TopAssetDto`, `ActivityLogDto`) to `src/dashboard/dto/`

### Commit 27 — Update .env.example
- Add `JWT_SECRET`, `PORT`, `JWT_EXPIRES_IN`, `CORS_ORIGINS`
- Add `MOCK_PAYMENT_ENABLED`
- Add comments explaining each variable (in English, matching project convention)

---

## Phase 6: E2E Tests (4 commits)

**Branch: `feature/e2e-tests`**

### Commit 28 — E2E: Assets endpoints
### Commit 29 — E2E: Wallet endpoints (balance, packages, purchase)
### Commit 30 — E2E: Marketplace endpoints (search, featured, trending)
### Commit 31 — E2E: Dashboard endpoints (metrics, top-assets, activity-logs)

Each uses the same pattern as the existing auth e2e test: `Test.createTestingModule({ imports: [AppModule] })` + supertest.

---

## Phase 7: Database & Migrations (3 commits)

**Branch: `feature/database-migrations`**

### Commit 32 — TypeORM migration config
- Update `typeorm.config.ts` to support migration CLI
- Add `data-source.ts` for TypeORM CLI

### Commit 33 — Initial migration
- Generate initial migration from entities
- Update `package.json` with migration scripts

### Commit 34 — Database seed refactor
- Make `seedDatabase()` more robust (check if DB is connected first)
- Add env var `DB_SEED_ON_STARTUP` to control behavior

---

## Phase 8: API Documentation (2 commits)

### Commit 35 — Swagger decorators for all controllers
- Add `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiQuery` to all endpoints
- Document request/response DTOs with `@ApiProperty`

### Commit 36 — Architecture Decision Records
- `docs/adr/001-docker-multi-stage.md` — why node:22-alpine, multi-stage
- `docs/adr/002-database-migrations.md` — why TypeORM migrations over sync

---

## Additional Ideas (stretch goals, +8 commits)

If still need more commits:

| Commit | Feature | Why meaningful |
|--------|---------|---------------|
| 37 | `.nvmrc` + `.node-version` | Ensures consistent Node version |
| 38 | Husky + lint-staged | Pre-commit hooks for lint/format |
| 39 | Commitlint | Conventional commit enforcement |
| 40 | `.env.development` example | Dev-specific defaults |
| 41 | API versioning (`/api/v1/`) | Version strategy |
| 42 | Pagination utility | Reusable pagination for all list endpoints |
| 43 | `CODEOWNERS` | Define module owners |
| 44 | `.tool-versions` (asdf) | Alternative to nvm for Node/Postgres versions |

---

### Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Seed runs before DB is ready in Docker | High | Entrypoint script must wait for Postgres healthcheck + pass `DB_WAIT_RETRIES` env |
| `DB_SYNCHRONIZE=true` in production | Medium | Document env var per environment; migrations Phase 7 removes sync reliance |
| JWT_SECRET falls back to 'dev-secret' | High | Environment validation (Phase 3, Commit 15) fails startup if JWT_SECRET missing in production |
| Stellar/Soroban SDK mocking in tests | Medium | Already done in auth tests (jest.mock pattern); reuse same pattern |
| TypeORM entities defined in two places (database/ + indexer/) | Low | Consolidate in Phase 7 |
| Helmet + CORS currently allow all origins | Medium | Phase 4 adds CORS_ORIGINS env var with validation |
| Swagger exposes endpoints in production | Medium | Only enable in dev with `NODE_ENV !== 'production'` guard |

### Ready for Proposal
**Yes** — proceed to `sdd-propose` for each phase as a separate change, starting with Phase 1 (Docker), then Phase 2 (Tests), then Phase 3-8.
