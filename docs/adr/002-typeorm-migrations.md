# ADR 002: TypeORM migrations for schema management

## Status
Accepted

## Context
The project initially relied on `synchronize: true`, which is convenient for development but unsafe for production schema management.

## Decision
Keep runtime support for the existing schema configuration but add a dedicated TypeORM data source and migration workflow for explicit schema evolution.

## Consequences
- Schema changes can be reviewed and applied deliberately
- Production deployments no longer rely on implicit table creation
- Local seeding remains available behind a config flag
