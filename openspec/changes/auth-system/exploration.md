# Exploration: Auth System Implementation

## Current State

The project is a NestJS 11 application with two feature modules (Payments, Tokens) and zero auth infrastructure. Key observations:

### Module Structure
- Both modules use the standard NestJS pattern: `@Module({ controllers, providers, exports })`
- **PaymentsModule** — registers controller, service, and adapters (Stripe, PayPal) as providers; exports `PaymentsService`
- **TokensModule** — registers `TokensService` only (no controller); exports `TokensService`; imports `ConfigModule.forFeature(sorobanConfig)`
- Both modules export their main service for cross-module use
- Projects use barrel exports (`index.ts`) in subdirectories (adapters, common/dto, common/interfaces)

### Config/Env Loading
- **Two approaches coexist (potential confusion):**
  1. `registerAs()` from `@nestjs/config` — used by `sorobanConfig` in `src/tokens/config/soroban.config.ts` and duplicated in `src/config/soroban.config.ts`
  2. `src/config/envs.ts` — exports a `configuration` function that validates env vars (PORT, DB_PORT, ENCRYPTION_KEY, etc.) but is **NOT loaded anywhere** — dead code
- `ConfigModule.forRoot({ isGlobal: true, load: [sorobanConfig] })` in AppModule
- **CRITICAL**: `src/config/setup.ts` defines `setupValidation`, `setupHelmet`, `setupCors`, `setupApp` — but **none are called** in `main.ts`. The app boots without global pipes, CORS, or helmet.

### Controller + DTO Conventions
- **Controllers**: `@Controller('payments')` with route prefix, constructor DI for service, `@nestjs/common Logger`, async/await
- **DTOs**: Classes with `class-validator` decorators (`@IsString()`, `@IsNumber()`, `@IsOptional()`, `@Min(0.01)`, `@IsObject()`)
- No custom validation groups or pipes — relies on global `ValidationPipe` (which exists in setup.ts but is NOT applied)
- API prefix `/api` is set in `setupApp()` — also not applied

### Test Patterns
- **Zero unit tests exist** — no `*.spec.ts` files anywhere
- One boilerplate e2e test at `test/app.e2e-spec.ts` tests `GET /` → 200 "Hello World!" (the NestJS default route, which won't pass since there's no root controller)
- **Jest 30** with `ts-jest` configured in `package.json` (rootDir: "src", testRegex: ".*\\.spec\\.ts$")
- `@nestjs/testing` available for `Test.createTestingModule` patterns

### Existing Dependencies
```json
// Already installed (relevant to auth)
"@nestjs/common": "^11.0.1",
"@nestjs/config": "^4.0.3",
"@nestjs/core": "^11.0.1",
"@nestjs/platform-express": "^11.0.1",
"class-validator": "^0.14.3",
"reflect-metadata": "^0.2.2",
"rxjs": "^7.8.1"

// Dev
"@nestjs/testing": "^11.0.1",
"jest": "^30.0.0",
"ts-jest": "^29.2.5"
```

## Affected Areas

- `src/auth/` — new module (entirely new domain)
- `src/app.module.ts` — register `AuthModule`
- `src/config/envs.ts` — add JWT_SECRET, JWT_EXPIRATION, SMTP_* env vars
- `src/main.ts` — must call `setupApp()` for ValidationPipe, CORS, helmet to work
- `src/config/setup.ts` — `setupApp()` may need auth-related middleware
- `package.json` — add auth dependencies
- `openspec/config.yaml` — no changes needed (tdd: true already set)

## Approaches

1. **Direct Provider Injection** — Standard NestJS module with AuthService, AuthController, JwtStrategy, LocalStrategy registered as providers
   - Pros: Follows existing project patterns exactly; straightforward
   - Cons: Less testable for TDD; harder to swap strategies
   - Effort: Low

2. **Adapter Pattern (like Payments)** — Abstract auth provider (e.g., `IAuthProvider`) with implementations (JWT, OAuth, etc.)
   - Pros: Follows existing adapter pattern; extensible for future OAuth providers
   - Cons: Over-engineering for initial JWT-only auth; adds unnecessary abstraction
   - Effort: Medium

## Recommendation

**Approach 1** — Standard NestJS module with direct providers. The Payments adapter pattern makes sense for payment gateways (multiple live external services), but auth starts with one clear strategy (JWT + Passport). Keep it simple, follow the existing module pattern:

```
src/auth/
├── auth.module.ts
├── auth.controller.ts
├── auth.service.ts
├── strategies/
│   ├── jwt.strategy.ts
│   └── local.strategy.ts
├── guards/
│   └── jwt-auth.guard.ts
├── common/
│   ├── dto/
│   │   ├── register.dto.ts
│   │   ├── login.dto.ts
│   │   └── verify-2fa.dto.ts
│   └── interfaces/
│       ├── auth-result.interface.ts
│       └── jwt-payload.interface.ts
└── __tests__/
    ├── auth.service.spec.ts
    ├── auth.controller.spec.ts
    └── strategies/
        ├── jwt.strategy.spec.ts
        └── local.strategy.spec.ts
```

## Dependencies to Install

```bash
# Auth core
npm install @nestjs/jwt @nestjs/passport passport passport-jwt passport-local bcrypt

# 2FA
npm install speakeasy qrcode

# Email (for 2FA delivery)
npm install nodemailer

# Dev types
npm install -D @types/passport-jwt @types/passport-local @types/bcrypt @types/nodemailer @types/speakeasy @types/qrcode
```

**Alternative email approach** (recommended): Use Resend SDK instead of raw nodemailer for simpler API and better deliverability. Would replace `nodemailer` + `@types/nodemailer` with `resend`.

## Risks

- **Dead config code**: `src/config/envs.ts` and `src/config/setup.ts` exist but are unused. The auth system needs proper env loading — we MUST either wire these up or create new config. Wiring them risks breaking nothing (they're not imported), but they reference DB_PORT, ENCRYPTION_KEY, etc. that may not have `.env` values locally.
- **No validation or CORS in prod**: `setupValidation()` (with global ValidationPipe) and `setupCors()` are never called. Auth endpoints wired without these means no DTO validation until we call `setupApp()` in `main.ts`.
- **ts-jest version mismatch**: package.json has `ts-jest: ^29.2.5` with Jest 30. ts-jest 29 claims Jest 30 support via `^29.2.5` since Jest 30 is recent (released Dec 2025), but integration should be verified if test failures occur.
- **No existing test patterns to follow**: Zero spec files means we're establishing test conventions from scratch. Must define test structure, mocks, and coverage expectations explicitly in this change.
- **`NoImplicitAny: false`**: TypeScript lax mode. Auth involves sensitive typing (JWT payloads, strategies). Should add explicit types.
- **Dual soroban config registration**: `sorobanConfig` is loaded in both `AppModule.forRoot()` and `TokensModule.forFeature()`. This works in NestJS (forFeature is a no-op if already loaded globally) but is confusing — don't copy this pattern for auth config.

## Ready for Proposal

Yes — full understanding of codebase patterns, config gaps, and the auth module structure is clear.
