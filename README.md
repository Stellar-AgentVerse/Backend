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
npm run start:dev
```

## Docker

```bash
docker compose up --build
docker compose down
```

## Tests

```bash
npm test
npm run test:cov
npm run build
```

## CI

`.github/workflows/ci.yml` runs on push and pull request to `main`.
It installs dependencies, then runs lint, tests, and build.

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
| `DB_SYNCHRONIZE` | `true` in dev, `false` in prod | TypeORM schema sync |
| `DB_LOGGING` | `false` | TypeORM SQL logging |
| `JWT_SECRET` | `dev-secret` in dev | JWT signing secret |
| `JWT_EXPIRES_IN` | `24h` | JWT token lifetime |
| `STELLAR_NETWORK` | `testnet` | Stellar network name |
| `STELLAR_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `STELLAR_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | Stellar network passphrase |
| `CORS_ORIGINS` | `*` in dev | Comma-separated allowed origins |
| `SOROBAN_TOKEN_MINT_CONTRACT_ID` | empty | Mint contract ID |
| `SOROBAN_TOKEN_SALE_CONTRACT_ID` | empty | Sale contract ID |
| `STELLAR_ADMIN_SECRET_KEY` | empty | Optional admin key |
| `SWAGGER_ENABLED` | `false` in prod | Force docs on in production |

## Notes

- `npm run start:dev` keeps the app in watch mode.
- Docker uses the repository `docker-compose.yml` and PostgreSQL service.
