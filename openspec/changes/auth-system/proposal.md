# Proposal: Wallet-Based Auth System

## Intent

AgentVerse is a Stellar-based marketplace with zero auth infrastructure — no user identity exists. This change enables wallet-based authentication using Stellar's native keypair verification, replacing the planned email/password flow with one native to the Stellar ecosystem.

## Scope

### In Scope

- Challenge endpoint (`POST /auth/challenge`) — generates and caches a unique challenge per `publicKey`
- Wallet verification endpoint (`POST /auth/wallet`) — verifies Stellar-signed challenge, creates/upserts user, issues JWT
- JWT guard + strategy for protecting `/api/*` routes
- User model: `publicKey` (PK), `displayName`, `avatar`, `createdAt`, `lastLoginAt`
- JWT config via `registerAs('jwt', ...)` matching `sorobanConfig` pattern

### Out of Scope

- Email/password registration or login
- 2FA / TOTP (speakeasy, qrcode)
- OAuth providers (Google, GitHub)
- Role-based access control
- Refresh token rotation
- User profile CRUD

## Capabilities

### New Capabilities

- `wallet-auth`: Stellar wallet-based authentication via challenge-response. Covers challenge generation, signature verification with `Keypair.verify()`, JWT issuance, and JWT validation guard.

### Modified Capabilities

None

## Approach

Standard NestJS module following existing patterns (PaymentsModule structure). Two public endpoints + `JwtAuthGuard` for protected routes. Flow: (1) challenge generates a nonce + timestamp signed payload cached per `publicKey`, (2) wallet verification uses `@stellar/stellar-sdk` `Keypair.fromPublicKey().verify()`, (3) on success, JWT issued with `{ publicKey, iat }`. User records upserted on first verification. JWT config uses `registerAs('jwt', ...)` matching `sorobanConfig` pattern in `src/config/`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/auth/` | New | Module, controller, service, strategy, guard, DTOs, interfaces |
| `src/config/jwt.config.ts` | New | `registerAs('jwt', ...)` config |
| `src/app.module.ts` | Modified | Register `AuthModule` |
| `package.json` | Modified | Add `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Challenge replay attack | Low | Challenge includes timestamp + short TTL; single-use |
| Stellar SDK verify() API mismatch | Low | Use installed v14 — stable API |
| No existing test patterns | Med | Establish conventions in this change; TDD mode active |

## Rollback Plan

- Revert `AuthModule` import in `src/app.module.ts`
- Delete `src/auth/` directory
- Remove `jwt.config.ts`
- `npm uninstall @nestjs/jwt @nestjs/passport passport passport-jwt`

## Dependencies

- `@stellar/stellar-sdk` v14 (already installed)
- Install: `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`
- Dev: `@types/passport-jwt`

## Success Criteria

- [ ] `POST /auth/challenge` returns unique challenge for valid Stellar publicKey
- [ ] `POST /auth/wallet` with valid signature returns JWT
- [ ] `POST /auth/wallet` with invalid signature returns 401
- [ ] Protected routes return 401 without valid Bearer token
- [ ] All tests pass with >=80% coverage
