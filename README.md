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

`docker-compose.yml` resolves `NODE_ENV` from your shell or `.env`, falling back to
`production`. Whenever it does not resolve to `development` or `test`, the API requires an
explicit `JWT_SECRET` and refuses to start without one — it no longer falls back to the
published `dev-secret`:

```bash
JWT_SECRET="$(openssl rand -hex 32)" docker compose up --build
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
It installs dependencies, then runs unit tests, e2e tests, build, and lint — in
that order.

`npm test` uses `rootDir: "src"` and therefore only runs `src/**/*.spec.ts`. The
integration tests under `test/` — including wallet authorization and environment
fail-closed coverage — run via `npm run test:e2e`, which CI invokes separately.

Lint runs last because `npm run lint` currently exits non-zero on a clean
checkout of `main`. It still fails the job; running it last means the test and
build results are visible rather than reported as skipped.

## Swagger

OpenAPI docs are available in development at:

```text
/api/docs
```

Docs use bearer auth and stay disabled in production unless `SWAGGER_ENABLED=true`.

## Deployment mode

`NODE_ENV` is an **allowlist**, not a production check. Development fallbacks — the
`dev-secret` JWT signing key, database seeding, and the simulated payment adapters —
apply only when `NODE_ENV` is exactly `development` or `test`.

Every other value, including `staging`, `prod`, `Production`, a typo, or leaving it
unset, is treated as a real deployment and fails closed. See `src/config/deployment-mode.ts`.

In a real deployment the application refuses to start if:

- `JWT_SECRET` is missing — wallet identity is derived from the JWT, so the published
  `dev-secret` fallback would let anyone mint a token for any wallet; or
- any of `PAYMENT_SIMULATION_ENABLED`, `MOCK_PAYMENT_ENABLED`, `MOCK_PAYMENT_FAIL` or
  `DB_SEED_ON_STARTUP` is enabled. The seed writes demo assets and a 450-credit
  wallet, which is fabricated state of the same kind as a fabricated payment.

It also stops applying development defaults: `DB_SYNCHRONIZE` defaults to `false`,
`CORS_ORIGINS` may not be `*`, and Swagger stays off unless `SWAGGER_ENABLED=true`.

## Wallet and credits

`/api/wallet/balance`, `/api/wallet/transactions` and `/api/wallet/purchase` require a
bearer token and derive the wallet **only** from the authenticated principal. There is no
request parameter that names a wallet, so one user cannot read or mutate another's by
changing a query string. Unauthenticated requests return `401`.

`/api/wallet/packages` is public — a signed-out client needs it to render the pricing page
— and returns catalogue data only.

Two things the API deliberately does **not** claim:

- **On-chain balance.** Nothing reads a verified Stellar balance, so `balance.onChain` is
  `{ status: "UNAVAILABLE", reason: "STELLAR_BALANCE_NOT_INTEGRATED", xlmBalance: null,
  xlmUsdEstimate: null, asOf: null }`. Returning `0` would be a false claim about
  someone's money; omitting the fields would leave a client rendering `undefined` with
  no way to say why.
- **Transaction hashes.** `WalletTransactionDto.ledgerReference` is populated only when the
  stored value is a real Stellar transaction hash (64 lowercase hex characters), and is
  `null` otherwise. Historic rows hold seeded and simulated identifiers that are never
  presented as on-chain activity.

Note that nothing writes `wallet_transactions` any more — the simulated purchase was its
only writer, and the seed fixtures are gone — so `GET /api/wallet/transactions` returns an
empty list on a fresh database. That is the honest state: there is no real money activity
to report. `ledgerReference` exists so that a future settlement path has somewhere to put
a verified hash without another response-shape change.

`GET /api/wallet/balance` does not create a wallet row. A caller with no row sees
`credits: 0` and the same `monthlyAllocation` default a created row would have carried,
so a read never writes.

**Credit package purchase is disabled** until the Market V1 economy ADR settles the
settlement asset and payout policy. Clients must read `purchase.supported` from
`GET /api/wallet/packages` and hide the action; posting anyway returns `501` whose
`message` is the stable reason code `CREDIT_PURCHASE_NOT_AVAILABLE`.

## Payments

No payment adapter has a real provider integration — neither the Stripe nor the PayPal SDK
is a dependency, and no adapter reaches the network. All of them fabricate their results,
so they run only when payment simulation is explicitly enabled, which is possible only in
`development` and `test`. Elsewhere they refuse without inventing an identifier, and
`GET /api/payments/providers` returns an empty list.

Every simulated result carries `metadata.simulated === true`. Identifiers the backend
invents are additionally prefixed `simulated_`; `verifyTransaction` echoes back the
identifier it was given, so that one is not prefixed.

`POST /api/payments`, `POST /api/payments/refund` and `GET /api/payments/verify/:id`
require a bearer token. `GET /api/payments/providers` is public so a client can probe
capability without one.

`MockPaymentAdapter` is registered as a provider but is not in `PaymentsService`'s adapter
registry, so no route reaches it today; `MOCK_PAYMENT_ENABLED` and `MOCK_PAYMENT_FAIL`
configure it for direct use and are gated at boot like the other simulation flags.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | unset (treated as a real deployment) | Development fallbacks apply only for `development` and `test` |
| `PORT` | `3000` | HTTP listen port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USERNAME` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `DB_NAME` | `agentverse` | Database name |
| `DB_SYNCHRONIZE` | `true` in `development`/`test`, `false` elsewhere | TypeORM schema sync |
| `DB_LOGGING` | `false` | TypeORM SQL logging |
| `DB_SEED_ON_STARTUP` | `true` in `development`/`test` | Seed sample data at boot; rejected at boot elsewhere |
| `JWT_SECRET` | `dev-secret` in `development`/`test`; **required** elsewhere | JWT signing secret |
| `JWT_EXPIRES_IN` | `24h` | JWT token lifetime |
| `PAYMENT_SIMULATION_ENABLED` | `false` | Lets the payment adapters fabricate results; rejected outside `development`/`test` |
| `MOCK_PAYMENT_ENABLED` | `false` | Enables the mock adapter; rejected outside `development`/`test` |
| `MOCK_PAYMENT_FAIL` | `false` | Makes the mock adapter fail; rejected outside `development`/`test` |
| `STRIPE_API_KEY` | empty | Simulated Stripe adapter credential (no real integration) |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | empty | Simulated PayPal adapter credentials (no real integration) |
| `PAYPAL_ENV` | `sandbox` | Reported in simulated PayPal metadata |
| `STELLAR_NETWORK` | `testnet` | Stellar network name |
| `STELLAR_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint |
| `STELLAR_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` | Stellar network passphrase |
| `SOROBAN_MARKETPLACE_CONTRACT_ID` | — | Deployed PromptMarketplace contract used by purchase intents |
| `SOROBAN_TOKEN_MINT_CONTRACT_ID` | empty | Mint contract ID |
| `SOROBAN_TOKEN_SALE_CONTRACT_ID` | empty | Sale contract ID |
| `STELLAR_ADMIN_SECRET_KEY` | empty | Optional admin key |
| `CORS_ORIGINS` | `*` in dev | Comma-separated allowed origins |
| `S3_ENDPOINT` / `S3_BUCKET` | `http://localhost:9000` / `agentverse-prompts` | S3-compatible prompt blob storage; Docker Compose runs MinIO locally |
| `PROMPT_CONTENT_ENCRYPTION_KEY` | — | Base64-encoded 32-byte key used to encrypt prompt blobs before storage |
| `AWS_REGION` | `us-east-1` | AWS region |
| `AWS_KMS_KEY_ID` | — | KMS key used with tenant and delivery encryption context |
| `PROMPT_DELIVERY_WORKER_ENABLED` | `false` | Enables the PostgreSQL delivery worker polling loop |
| `SWAGGER_ENABLED` | off outside `development`/`test` | Force docs on in a real deployment |

## Marketplace purchase flow

Purchase intents are JWT-protected and scoped to published `PROMPT` assets. The buyer signs the returned unsigned XDR locally, then submits only the transaction hash for RPC verification. Run the purchase migration before starting a deployment:

```bash
npm run migration:run
```

Production requires `SOROBAN_MARKETPLACE_CONTRACT_ID`; the Testnet contract cannot be omitted or replaced by the development mock.

## Notes

- `npm run start:dev` keeps the app in watch mode.
- Docker uses the repository `docker-compose.yml` and PostgreSQL service.
