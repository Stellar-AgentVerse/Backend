# Design: Wallet-Based Auth System

## Technical Approach

Standard NestJS 11 module following existing patterns (PaymentsModule). Two-phase challenge-response flow using Stellar `Keypair.verify()` — no email/password. In-memory stores with interface abstractions for future DB swap. JWT config via `registerAs('jwt', ...)` matching the `sorobanConfig` pattern in `src/config/`.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|----------|---------|--------|-----------|
| Challenge storage | In-memory Map, Redis | **In-memory `Map<string, ChallengeEntry>`** | No infra dependency; MVP doesn't need Redis. Challenges have TTL + lazy validation. Periodic sweep via `setInterval` for cleanup. |
| JWT config pattern | `registerAs`, raw `process.env` | **`registerAs('jwt', ...)`** | Matches existing `sorobanConfig` — consistent with project conventions. |
| User storage | In-memory Map, TypeORM, Prisma | **`Map<string, User>` + `UserRepository` interface** | No DB in the project yet. Interface enables future swap to real DB without changing consumers. |
| Auth provider abstraction | Adapter (like Payments), Direct providers | **Direct providers** | Single auth strategy (JWT) doesn't justify an adapter layer. Avoid over-engineering. |
| Challenge expiry | `setTimeout` delete, TTL + lazy check | **TTL field + lazy validation** | On `verifyWallet`, check `expiresAt`. Periodic sweep clears stale entries. Simpler than per-entry timers. |
| Signature data format | Raw challenge string, hash challenge | **Raw challenge string → `Buffer`** | Stellar `Keypair.verify()` takes `Buffer` directly. No hashing needed — the wallet signs the challenge as-is. |

## Data Flow

```
 Client                           AuthService                    ChallengeStore    UserRepo    Stellar SDK
   │                                  │                              │                │             │
   │  POST /auth/challenge            │                              │                │             │
   │  { publicKey: "G..." }          │                              │                │             │
   │─────────────────────────────────>│                              │                │             │
   │                                  │  Generate UUID challenge     │                │             │
   │                                  │  + expiresAt (5 min)        │                │             │
   │                                  │─────────────────────────────>│ store          │             │
   │                                  │<─────────────────────────────│ ok             │             │
   │  { challenge, expiresAt }        │                              │                │             │
   │<─────────────────────────────────│                              │                │             │
   │                                  │                              │                │             │
   │  [Wallet signs challenge         │                              │                │             │
   │   with user's secret key]        │                              │                │             │
   │                                  │                              │                │             │
   │  POST /auth/wallet               │                              │                │             │
   │  { publicKey, signature }        │                              │                │             │
   │─────────────────────────────────>│                              │                │             │
   │                                  │─────────────────────────────>│ get challenge  │             │
   │                                  │<─────────────────────────────│ entry          │             │
   │                                  │                              │                │             │
   │                                  │  Check expiresAt             │                │             │
   │                                  │  Delete challenge (single-use)│               │             │
   │                                  │                              │                │             │
   │                                  │  Keypair.fromPublicKey(pk)   │                │             │
   │                                  │  .verify(challenge, sig)     │────────────────────────────>│
   │                                  │<─────────────────────────────────────────────────────────│
   │                                  │  true/false                  │                │             │
   │                                  │                              │                │             │
   │                                  │  findOrCreate(publicKey)     │────────────────>│             │
   │                                  │<──────────────────────────────────────────────│             │
   │                                  │  user                         │                │             │
   │                                  │                              │                │             │
   │                                  │  Sign JWT { publicKey, iat } │                │             │
   │  { token, user }                 │                              │                │             │
   │<─────────────────────────────────│                              │                │             │
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/auth/auth.module.ts` | Create | Module registration, imports `JwtModule.registerAsync`, `PassportModule` |
| `src/auth/auth.controller.ts` | Create | `POST /auth/challenge`, `POST /auth/wallet` endpoints |
| `src/auth/auth.service.ts` | Create | Challenge generation, wallet signature verification, JWT signing |
| `src/auth/strategies/jwt.strategy.ts` | Create | Passport JWT strategy extracting Bearer token, validating payload |
| `src/auth/guards/jwt-auth.guard.ts` | Create | `@UseGuards(JwtAuthGuard)` — extends `AuthGuard('jwt')` |
| `src/auth/common/dto/challenge.dto.ts` | Create | `@IsString() publicKey` — Stellar G... address |
| `src/auth/common/dto/verify-wallet.dto.ts` | Create | `publicKey`, `signature` (both strings) with class-validator |
| `src/auth/common/interfaces/auth-result.interface.ts` | Create | `{ token: string, user: User }` |
| `src/auth/common/interfaces/jwt-payload.interface.ts` | Create | `{ publicKey: string, iat: number }` |
| `src/auth/models/user.interface.ts` | Create | `User` interface — `publicKey`, `displayName?`, `avatar?`, `createdAt`, `lastLoginAt` |
| `src/auth/models/user.entity.ts` | Create | In-memory user class implementing `User` |
| `src/auth/repositories/user-repository.interface.ts` | Create | `findOrCreate(pk): User`, `findByPublicKey(pk): User \| null`, `updateLastLogin(pk): void` |
| `src/auth/repositories/in-memory-user.repository.ts` | Create | `Map<string, User>`-based implementation |
| `src/config/jwt.config.ts` | Create | `registerAs('jwt', () => ({ secret, expiresIn }))` |
| `src/app.module.ts` | Modify | Add `AuthModule` to imports, load `jwtConfig` in `ConfigModule.forRoot` |
| `package.json` | Modify | Add `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `@types/passport-jwt` |

## Interfaces / Contracts

```typescript
// User model — core identity record
enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

interface User {
  publicKey: string;        // Stellar G... address
  status: UserStatus;       // default UserStatus.ACTIVE
  displayName: string;      // default '' — never null
  avatar: string;           // default '' — never null
  createdAt: Date;
  lastLoginAt: Date;
}

// Challenge store entry
interface ChallengeEntry {
  challenge: string;        // UUID v4
  publicKey: string;
  expiresAt: Date;
}

// User repository — injectable, swappable
interface UserRepository {
  findOrCreate(publicKey: string): User;
  findByPublicKey(publicKey: string): User | null;
  updateLastLogin(publicKey: string): void;
}

// Auth service result
interface AuthResult {
  token: string;
  user: User;
}

// JWT payload
interface JwtPayload {
  publicKey: string;
  iat: number;
}
```

**Verification pattern** (non-obvious):
```typescript
// auth.service.ts
const keypair = Keypair.fromPublicKey(publicKey);
const isValid = keypair.verify(
  Buffer.from(challenge, 'utf-8'),
  Buffer.from(signature, 'hex'),
);
```

The challenge is a plain UTF-8 string (UUID). The Stellar wallet signs it with the user's secret key. We decode the hex signature into a Buffer and compare against the public key.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `AuthService.generateChallenge` | Assert challenge is UUID, `expiresAt` is ~5 min from now, stored in challenge store |
| Unit | `AuthService.verifyWallet` — valid sig | Mock `Keypair.verify()` returning `true`; assert JWT is returned |
| Unit | `AuthService.verifyWallet` — invalid sig | Mock `Keypair.verify()` returning `false`; assert 401 |
| Unit | `AuthService.verifyWallet` — expired | Create stale challenge; assert 401 `Challenge expired` |
| Unit | `AuthService.verifyWallet` — missing challenge | Assert 404 `Challenge not found` |
| Unit | `InMemoryUserRepository.findOrCreate` | First call creates, second call returns existing |
| Unit | `JwtStrategy.validate` | Return payload with `publicKey` |
| Unit | `JwtAuthGuard` | Extends `AuthGuard('jwt')` — test via controller |
| Integration | `AuthController` | `Test.createTestingModule` with supertest; full challenge → verify → JWT flow |
| E2E | Full auth flow | `test/jest-e2e.json` — wire up app, hit endpoints, verify JWT protects routes |

**Mock setup**: The challenge store and `UserRepository` are injectable tokens — mocked in `TestingModule`. For `Keypair.verify()`, we mock `@stellar/stellar-sdk` at the module level.

## Migration / Rollout

No migration required. The auth module is entirely new — no existing user data to migrate. Once deployed:
1. Clients call `POST /api/auth/challenge` with their Stellar public key
2. Client signs the challenge with their wallet
3. Client calls `POST /api/auth/wallet` with signature → receives JWT
4. Client includes `Authorization: Bearer <token>` in subsequent requests

## Open Questions

- [ ] JWT expiry duration — proposal doesn't specify. Default to 24h? Configurable via env.
