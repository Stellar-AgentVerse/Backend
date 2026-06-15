# ADR 001: Multi-stage Docker image

## Status
Accepted

## Context
The backend needs a production-ready Docker image that keeps runtime size and attack surface small while still supporting local development with PostgreSQL and startup seeding.

## Decision
Use a multi-stage Docker build based on `node:22-alpine`.

## Consequences
- Smaller production image
- Clear separation between build and runtime dependencies
- Easier to run the app consistently in CI and local compose
