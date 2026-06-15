# Tasks: Wallet-Based Auth System

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Core Logic) → PR 2 (Integration + Wiring) |
| Delivery strategy | size:exception |
| Chain strategy | single-pr |

Decision needed before apply: Yes — resolved size:exception
Chained PRs recommended: Yes — overridden by maintainer acceptance
Chain strategy: single-pr
400-line budget risk: High — accepted as size:exception

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation + Stores + Auth Service | PR 1 | Deps, config, models, stores, core service + unit tests (~400 lines) |
| 2 | Controller + Strategy + Guard + Module + E2E | PR 2 | DTOs, controller, passport, wiring, e2e (~400 lines) |

## Phase 1: Foundation

- [x] 1.1 Install deps: `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `@types/passport-jwt`
- [x] 1.2 Create `src/config/jwt.config.ts` — `registerAs('jwt', () => ({ secret, expiresIn }))`
- [x] 1.3 Create `src/auth/models/user.interface.ts` — `User` interface + `UserStatus` enum
- [x] 1.4 Create `src/auth/models/user.entity.ts` — in-memory User class implementing `User`
- [x] 1.5 Create `src/auth/common/interfaces/jwt-payload.interface.ts`
- [x] 1.6 Create `src/auth/common/interfaces/auth-result.interface.ts`

## Phase 2: Stores & Repositories (TDD)

- [x] 2.1 Create `src/auth/stores/challenge-store.interface.ts` — `set/get/delete` + TTL check contracts
- [x] 2.2 [RED] Write failing tests for `InMemoryChallengeStore`
- [x] 2.3 [GREEN] Create `src/auth/stores/in-memory-challenge.store.ts` — `Map<string, ChallengeEntry>` with TTL + sweep
- [x] 2.4 Create `src/auth/repositories/user-repository.interface.ts` — `findOrCreate`, `findByPublicKey`, `updateLastLogin`
- [x] 2.5 [RED] Write failing tests for `InMemoryUserRepository`
- [x] 2.6 [GREEN] Create `src/auth/repositories/in-memory-user.repository.ts`

## Phase 3: Auth Service (TDD)

- [x] 3.1 Create `src/auth/common/dto/challenge.dto.ts` — `@IsString() publicKey`
- [x] 3.2 Create `src/auth/common/dto/verify-wallet.dto.ts` — `publicKey`, `signature` with class-validator
- [x] 3.3 [RED] Write failing tests for `AuthService` (challenge gen, valid/invalid sig, expired/missing challenge)
- [x] 3.4 [GREEN] Create `src/auth/auth.service.ts` — challenge gen, `Keypair.verify()`, JWT signing

## Phase 4: Controller & Strategies (TDD)

- [x] 4.1 [RED] Write integration test for `AuthController` (challenge → verify → JWT → protected route)
- [x] 4.2 [GREEN] Create `src/auth/auth.controller.ts` — `POST /auth/challenge`, `POST /auth/wallet`
- [x] 4.3 Create `src/auth/strategies/jwt.strategy.ts` — passport-jwt Bearer strategy, `validate()` returns payload
- [x] 4.4 Create `src/auth/guards/jwt-auth.guard.ts` — extends `AuthGuard('jwt')`

## Phase 5: Module Wiring

- [x] 5.1 Create `src/auth/auth.module.ts` — `JwtModule.registerAsync`, `PassportModule`, providers, exports
- [x] 5.2 Modify `src/app.module.ts` — add `AuthModule` to imports, load `jwtConfig` in `ConfigModule.forRoot`

## Phase 6: E2E

- [x] 6.1 [RED] Write `test/auth.e2e-spec.ts` — full flow: challenge, verify, JWT protects protected route
- [x] 6.2 [GREEN] Verify all tests pass with coverage ≥ 80%
