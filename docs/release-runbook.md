# Testnet Staging Release Runbook

Covers provisioning, verifying, and rolling back the Testnet staging environment
for the Backend. Values that only a maintainer with deploy access can produce are
left empty and marked `TODO(maintainer)` next to the command that produces them.
An invented URL or contract id here would read as evidence, so none are written.

## Environment contract

`src/config/env.validation.ts` requires the deployment variables marked as
required below when `NODE_ENV=production`; bootstrap throws naming the first
missing one. Token contract IDs and the admin signing key remain optional until
their write operations are enabled. `AWS_KMS_KEY_ID` becomes required when the
prompt delivery worker is enabled.

| Variable | Notes |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | PostgreSQL 16 connection. |
| `JWT_SECRET` | Session signing key. Rotating it invalidates every issued token. |
| `STELLAR_NETWORK`, `STELLAR_RPC_URL`, `STELLAR_NETWORK_PASSPHRASE` | `testnet`, the Soroban RPC endpoint, and `Test SDF Network ; September 2015`. |
| `SOROBAN_MARKETPLACE_CONTRACT_ID` | Deployed PromptMarketplace. A value containing `PLACEHOLDER` is treated as unconfigured by the health check and by the purchase mock gate. |
| `SOROBAN_TOKEN_MINT_CONTRACT_ID`, `SOROBAN_TOKEN_SALE_CONTRACT_ID` | Token contracts. Absent values degrade token operations rather than blocking boot. |
| `STELLAR_ADMIN_SECRET_KEY` | Long-lived signing key for admin token operations. See **Secret ownership**. |
| `CORS_ORIGINS` | Explicit origins. `*` is rejected in production. |
| `AWS_REGION` | Required AWS region. |
| `AWS_KMS_KEY_ID` | Required when `PROMPT_DELIVERY_WORKER_ENABLED=true`; KMS key for encrypted prompt delivery. |

Set `DB_SYNCHRONIZE=false`; `.env.example` already does. Compose interpolates
`${DB_SYNCHRONIZE}` from that same `.env`, so the file the operator copies is what
the container actually gets — a `true` there defeats the compose default.
Auto-synchronize against a migrated database rewrites columns and indexes in
place; on `purchases` it would drop and re-add `transactionHash`, discarding the
hashes the replay guard depends on.

Optional: `RUN_MIGRATIONS_ON_START` (default `true`) and
`PROMPT_DELIVERY_WORKER_ENABLED`, which the worker compares to the exact string
`true` — `1`, `TRUE` and `yes` all leave it disabled.

## Deploy

The container entrypoint waits for PostgreSQL, applies migrations, and aborts the
boot if any migration fails, so a clean environment provisions itself.

```bash
docker compose up --build -d
docker compose logs -f api
```

Compose defaults `NODE_ENV` to `production` but supplies only nine of the sixteen
required variables itself; the rest come from the `.env` file it reads.
`cp .env.example .env` alone is not enough — `SOROBAN_MARKETPLACE_CONTRACT_ID`,
`SOROBAN_TOKEN_MINT_CONTRACT_ID`, `SOROBAN_TOKEN_SALE_CONTRACT_ID`,
`STELLAR_ADMIN_SECRET_KEY` and `AWS_KMS_KEY_ID` ship empty. Fill the KMS key if
the delivery worker is enabled. Fill the optional token/admin values before
using token operations, or run with
`NODE_ENV=development` for a local stack.

Without Docker, the same sequence is:

```bash
npm ci && npm run build
npm run migration:run:prod
npm run start:prod
```

`migration:run:prod` uses the compiled data source, so it works in the production
image where `ts-node` has been pruned. Set `RUN_MIGRATIONS_ON_START=false` and run
migrations as a separate release step before a multi-replica rollout; concurrent
migration runners race.

## Verify

```bash
curl -fsS "$BASE_URL/api/health"
```

A ready deployment answers `200` with `status: "ok"` and a `checks` array. Each
required check must be `ok`:

- **database** — `SELECT 1` round-trip.
- **schema** — `detail` is the most recently applied migration. Compare it with
  the newest file in `src/database/migrations/`; a mismatch means the deploy is
  running against an older schema.
- **sorobanRpc** — required once a real marketplace contract is configured.
- **marketplaceContract** — required when configured; health reads its persistent
  contract-instance ledger entry through Soroban RPC rather than trusting the ID.
- **deliveryWorker** — required when enabled and must have a KMS key configured.

`GET /api/health/live` answers process liveness only. Use it for restart probes
so a transient dependency outage does not cycle containers, and `/api/health` for
rollout and load-balancer gates.

Then run the smoke suite against a **migrated, unconfigured** database — a
throwaway one, or a staging database with no marketplace contract set:

```bash
npm run test:smoke
```

It refuses to run without `DB_HOST` and `DB_NAME` rather than passing vacuously.

It does not run against a fully configured environment. With a real
`SOROBAN_MARKETPLACE_CONTRACT_ID`, building a purchase intent goes to Soroban RPC
and needs a funded buyer account, which is criterion 4's blocker, not something
the suite can arrange. Point it at the deployment's schema, not its live
contract, until that is resolved.

## Evidence to record

Fill this table on every staging release and attach it to the release issue.

| Item | Value | How to produce it |
| --- | --- | --- |
| Backend URL | `TODO(maintainer)` | Deploy target's public URL. |
| UI URL | `TODO(maintainer)` | Blocked: see **Known gaps**. |
| Marketplace contract id | `TODO(maintainer)` | From the Smart-contracts deploy; must not contain `PLACEHOLDER`. |
| Applied migration | `TODO(maintainer)` | `curl -fsS "$BASE_URL/api/health" \| jq -r '.checks[] \| select(.name=="schema") \| .detail'` |
| Image digest | `TODO(maintainer)` | Only once images are published to a registry — no workflow in this repo builds or pushes one. Until then record the commit and the local image id: `docker image inspect --format '{{.Id}}' <image>`. |
| Commit | `TODO(maintainer)` | `git rev-parse HEAD` |
| Smoke run | `TODO(maintainer)` | URL of the `staging-smoke` workflow run for that commit. |

## Rollback and reconciliation

Roll back the application first, schema second, and only when the schema is
actually the problem.

1. Redeploy the previous build — by image digest if the deployment publishes
   images, otherwise by the previous commit — with `RUN_MIGRATIONS_ON_START=false`,
   so the rollback cannot re-apply the migration being backed out.
2. Confirm `/api/health` reports the expected `schema` detail for that image.
3. Revert one migration at a time with
   `node ./node_modules/typeorm/cli.js migration:revert -d dist/database/data-source.js`,
   checking `/api/health` between each.

Reconciliation notes:

- `AlignMigratedSchemaWithEntities1700000004000` cannot fully revert. PostgreSQL
  cannot remove an enum value, so `MODEL` and `ORACLE` remain on
  `asset_type_enum` after a revert. They are additive and unused by existing
  rows; leaving them is safe.
- `AddAuthChallenges1700000005000` creates the durable single-use wallet
  challenge table. Revert it only after no in-flight authentication requests
  depend on that table.
- Never resolve schema drift by enabling `DB_SYNCHRONIZE`. Write a migration.
- A confirmed Stellar transaction cannot be reversed. Reconcile a bad settlement
  by correcting listing access and the matching credit, never by rewriting
  `purchases.transactionHash` — the partial unique index on it is the replay
  guard.
- For delivery incidents, follow `docs/prompt-delivery-runbook.md`.

## Secret ownership

Deploy-environment secrets are held by the Stellar-AgentVerse maintainers, not by
contributors. No secret in this repository, and no value printed by CI.

| Secret | Owner | Rotation |
| --- | --- | --- |
| `STELLAR_ADMIN_SECRET_KEY` | Maintainers | Fund a new Testnet identity, migrate contract admin to it, then retire the old key. |
| `JWT_SECRET` | Maintainers | Rotate on suspicion of exposure; every issued token is invalidated. |
| `AWS_KMS_KEY_ID` | Maintainers | Follow the key-rotation entry in `docs/prompt-delivery-runbook.md`. Never export DEKs. |
| `DB_PASSWORD` | Maintainers | Rotate in the database first, then the deployment. |

The `staging-smoke` workflow configures no long-lived signing key. It generates a throwaway
Stellar keypair inside a single step to satisfy production env validation, never
writes it to a file or to `$GITHUB_ENV`, and never signs with it. A final step
fails the run if a Stellar secret seed appears in a tracked file or in the
captured application log.

## Known gaps

Blocking issues, not oversights. Each is out of scope for the staging provisioning
work and tracked elsewhere.

- **No deployed environment.** The repository has no GitHub deployments and no
  hosting account a contributor can reach. Every procedure above is exercised in
  CI against a throwaway PostgreSQL; none of it has been run against a real
  deployed URL.
- **No UI wallet authentication.** The UI does not implement the Freighter
  challenge/verify handshake against these endpoints, so the deployed-UI leg of
  the journey cannot be verified. The Backend side is covered by the smoke
  suite's wallet-authentication group.
- **No publication boundary.** Nothing publishes an asset over HTTP; `POST
  /api/assets` creates a `DRAFT` and no route promotes it. The smoke suite
  promotes its fixture directly in the database and says so. Tracked by #15.
- **No settled Testnet purchase.** Confirmation does not enqueue a delivery
  command, and no AI provider adapter is registered, so a purchase cannot
  produce an encrypted delivery result. Tracked by #9. The smoke suite marks
  that case as pending rather than asserting a substitute.
- **Chain verification is not exercised in CI.** With no marketplace contract
  configured, purchase confirmation runs in its mock-verification mode. The
  purchase guards the suite asserts are all evaluated before verification is
  reached, so they hold either way; the verification step itself is not covered.
