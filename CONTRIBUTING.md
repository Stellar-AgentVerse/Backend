# Contributing

## Prerequisites

- Node.js 22
- PostgreSQL 16
- Docker (optional, for local compose)

## Setup

```bash
npm install
cp .env.development .env
npm run start:dev
```

## Testing

```bash
npm test          # unit tests
npm run test:e2e  # e2e tests
npm run test:cov  # coverage
```

## Commits

This repo uses conventional commits:

- `feat:` — new feature
- `fix:` — bug fix
- `test:` — tests
- `docs:` — documentation
- `refactor:` — code restructuring
- `chore:` — maintenance

## PRs

Keep PRs under 400 changed lines when possible. Split large changes into stacked PRs.
