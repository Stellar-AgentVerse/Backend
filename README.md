# AgentVerse Stellar Backend

NestJS 11 backend for the AgentVerse Stellar platform.

## Overview

The application exposes a `/api` prefix and is organized by feature module:

- `AuthModule` — JWT auth and challenge flow
- `PaymentsModule` — payment adapters and orchestration
- `TokensModule` — Soroban token operations
- `DatabaseModule` — TypeORM + PostgreSQL setup
- `AssetsModule`, `WalletModule`, `MarketplaceModule`, `DashboardModule`, `IndexerModule`, `HealthModule`

Shared bootstrap lives in `src/config/setup.ts` and includes validation, Helmet, and CORS.
Environment validation is centralized in `src/config/env.validation.ts`.

## Prerequisites

- Node.js 22+
- npm 10+
- PostgreSQL 16+

## Local setup

```bash
npm ci
cp .env.example .env
npm run migration:run
npm run start:dev
```

`.env.example` sets `DB_SYNCHRONIZE=false`, so the schema comes from migrations
here exactly as it does in a deployment. Until they are applied, `/api/health`
reports the missing schema and answers 503.

## Docker

```bash
docker compose up --build
docker compose down
```

## Tests

```bash
npm test          # unit tests
npm run test:e2e  # e2e tests, no database required
npm run test:cov
npm run build
```

The staging smoke suite is separate because it needs a real, migrated database:

```bash
npm run migration:run
npm run test:smoke
```

It refuses to run unless `DB_HOST` and `DB_NAME` are set, so it cannot pass by
finding nothing to do.

## CI

`.github/workflows/ci.yml` runs on push and pull request to `main`.
It installs dependencies, then runs lint, tests, and build.

`.github/workflows/staging-smoke.yml` provisions a throwaway production-like
environment on the same events: it builds, applies migrations with the compiled
data source, boots the compiled app under production validation with
`DB_SYNCHRONIZE=false`, probes `/api/health`, and runs the smoke suite.

## Health

| Endpoint | Answers | Use for |
| --- | --- | --- |
| `GET /api/health` | Database, applied migration, Soroban RPC, marketplace contract, delivery worker. `503` when a required dependency is down | Rollout gates, load balancers |
| `GET /api/health/live` | Process liveness only, always `200` | Restart probes |

## Deployment

See `docs/release-runbook.md` for the environment contract, deploy and rollback
procedure, evidence to record, and the gaps that block a full release.

## Swagger

OpenAPI docs are available in development at:

```text
/api/docs
```

Docs use bearer auth and stay disabled in production unless `SWAGGER_ENABLED=true`.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USERNAME` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `DB_NAME` | `agentverse` | Database name |
| `DB_SYNCHRONIZE` | `false` in `.env.example`; `false` in prod | TypeORM schema sync. Keep `false` wherever migrations own the schema — Compose interpolates `.env`, so this file decides what the container gets |
| `DB_LOGGING` | `false` | TypeORM SQL logging |
| `JWT_SECRET` | `dev-secret` in dev | JWT signing secret |
| `JWT_EXPIRES_IN` | `24h` | JWT token lifetime |
| `SOROBAN_MARKETPLACE_CONTRACT_ID` | — | Deployed PromptMarketplace contract used by purchase intents |
| `S3_ENDPOINT` / `S3_BUCKET` | `http://localhost:9000` / `agentverse-prompts` | S3-compatible prompt blob storage; Docker Compose runs MinIO locally |
| `PROMPT_CONTENT_ENCRYPTION_KEY` | — | Base64-encoded 32-byte key used to encrypt prompt blobs before storage |
| `AWS_KMS_KEY_ID` | — | KMS key used with tenant and delivery encryption context |
| `PROMPT_DELIVERY_WORKER_ENABLED` | `false` | Enables the PostgreSQL delivery worker polling loop |
| `STELLAR_NETWORK` | `testnet` | Stellar network name |
| `STELLAR_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `STELLAR_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | Stellar network passphrase |
| `CORS_ORIGINS` | `*` in dev | Comma-separated allowed origins |
| `SOROBAN_TOKEN_MINT_CONTRACT_ID` | empty | Mint contract ID |
| `SOROBAN_TOKEN_SALE_CONTRACT_ID` | empty | Sale contract ID |
| `STELLAR_ADMIN_SECRET_KEY` | empty | Admin signing key. Optional at boot; required by env validation when `NODE_ENV=production` |
| `SWAGGER_ENABLED` | `false` in prod | Force docs on in production |
| `RUN_MIGRATIONS_ON_START` | `true` | Container entrypoint applies migrations before starting |

## Marketplace purchase flow

Purchase intents are JWT-protected and scoped to published `PROMPT` assets. The buyer signs the returned unsigned XDR locally, then submits only the transaction hash for RPC verification. Migrations must be applied before a deployment serves traffic; the container entrypoint does this automatically, and outside Docker:

```bash
npm run migration:run       # from source, uses ts-node
npm run migration:run:prod  # from dist/, for the production image
```

Production requires `SOROBAN_MARKETPLACE_CONTRACT_ID`; the Testnet contract cannot be omitted or replaced by the development mock.

## Notes

- `npm run start:dev` keeps the app in watch mode.
- Docker uses the repository `docker-compose.yml` and PostgreSQL service.
