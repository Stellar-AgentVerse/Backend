# Tasks: Wallet-Based Auth System

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Core Logic) → PR 2 (Integration + Wiring) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation + Stores + Auth Service | PR 1 | Deps, config, models, stores, core service + unit tests (~400 lines) |
| 2 | Controller + Strategy + Guard + Module + E2E | PR 2 | DTOs, controller, passport, wiring, e2e (~400 lines) |

## Phase 1: Foundation

- [ ] 1.1 Install deps: `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `@types/passport-jwt`
- [ ] 1.2 Create `src/config/jwt.config.ts` — `registerAs('jwt', () => ({ secret, expiresIn }))`
- [ ] 1.3 Create `src/auth/models/user.interface.ts` — `User` interface + `UserStatus` enum
- [ ] 1.4 Create `src/auth/models/user.entity.ts` — in-memory User class implementing `User`
- [ ] 1.5 Create `src/auth/common/interfaces/jwt-payload.interface.ts`
- [ ] 1.6 Create `src/auth/common/interfaces/auth-result.interface.ts`

## Phase 2: Stores & Repositories (TDD)

- [ ] 2.1 Create `src/auth/stores/challenge-store.interface.ts` — `set/get/delete` + TTL check contracts
- [ ] 2.2 [RED] Write failing tests for `InMemoryChallengeStore`
- [ ] 2.3 [GREEN] Create `src/auth/stores/in-memory-challenge.store.ts` — `Map<string, ChallengeEntry>` with TTL + sweep
- [ ] 2.4 Create `src/auth/repositories/user-repository.interface.ts` — `findOrCreate`, `findByPublicKey`, `updateLastLogin`
- [ ] 2.5 [RED] Write failing tests for `InMemoryUserRepository`
- [ ] 2.6 [GREEN] Create `src/auth/repositories/in-memory-user.repository.ts`

## Phase 3: Auth Service (TDD)

- [ ] 3.1 Create `src/auth/common/dto/challenge.dto.ts` — `@IsString() publicKey`
- [ ] 3.2 Create `src/auth/common/dto/verify-wallet.dto.ts` — `publicKey`, `signature` with class-validator
- [ ] 3.3 [RED] Write failing tests for `AuthService` (challenge gen, valid/invalid sig, expired/missing challenge)
- [ ] 3.4 [GREEN] Create `src/auth/auth.service.ts` — challenge gen, `Keypair.verify()`, JWT signing

## Phase 4: Controller & Strategies (TDD)

- [ ] 4.1 [RED] Write integration test for `AuthController` (challenge → verify → JWT → protected route)
- [ ] 4.2 [GREEN] Create `src/auth/auth.controller.ts` — `POST /auth/challenge`, `POST /auth/wallet`
- [ ] 4.3 Create `src/auth/strategies/jwt.strategy.ts` — passport-jwt Bearer strategy, `validate()` returns payload
- [ ] 4.4 Create `src/auth/guards/jwt-auth.guard.ts` — extends `AuthGuard('jwt')`

## Phase 5: Module Wiring

- [ ] 5.1 Create `src/auth/auth.module.ts` — `JwtModule.registerAsync`, `PassportModule`, providers, exports
- [ ] 5.2 Modify `src/app.module.ts` — add `AuthModule` to imports, load `jwtConfig` in `ConfigModule.forRoot`

## Phase 6: E2E

- [ ] 6.1 [RED] Write `test/auth.e2e-spec.ts` — full flow: challenge, verify, JWT protects protected route
- [ ] 6.2 [GREEN] Verify all tests pass with coverage ≥ 80%
