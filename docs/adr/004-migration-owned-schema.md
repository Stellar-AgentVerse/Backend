# ADR 004: Migrations own the deployed schema

## Status
Accepted

## Context
ADR 002 added a migration workflow but left `synchronize` as a runtime option, and
nothing applied migrations at deploy time. Both `docker-compose.yml` and the `ci`
workflow therefore ran with `DB_SYNCHRONIZE=true`, so every environment built its
schema by auto-synchronize and no environment exercised the migrations.

That hid drift between the migration DDL and the entity definitions. All fifteen
uuid primary keys were created without `DEFAULT uuid_generate_v4()`, which
`@PrimaryGeneratedColumn('uuid')` depends on, and `asset_type_enum` was created
with four of the six declared `AssetType` values. A deployment provisioned by
migrations connected, reported healthy, and then failed every insert.

## Decision
Migrations are the only mechanism that builds the deployed schema.

- `entrypoint.sh` applies migrations before starting the process and aborts the
  boot if any fails, so a clean deploy provisions itself and never serves traffic
  on a half-built schema.
- `docker-compose.yml` defaults `DB_SYNCHRONIZE` to `false`.
- A migration aligns the existing schema with the entities, and the staging smoke
  suite asserts there is no remaining drift that changes what the database can
  store. Identifier-only differences — index, foreign-key and enum type names —
  are tolerated: the migrations name them explicitly while TypeORM derives hashed
  names, and neither affects a deployment running with `synchronize: false`.

## Consequences
- A schema change that is not expressed as a migration fails the smoke suite
  rather than being silently applied at startup.
- Multi-replica rollouts must set `RUN_MIGRATIONS_ON_START=false` and run
  migrations as a separate release step; concurrent runners race.
- Reverting is bounded by what PostgreSQL can undo. Enum values cannot be
  removed, so migration down paths are documented rather than assumed reversible.
