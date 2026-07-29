## Exploration: token-marketplace

### Current State

The backend is a NestJS 11 + TypeScript project with two modules:

**Payments Module** (`src/payments/`)
- Mature adapter pattern: `IPaymentAdapter` interface → `BasePaymentAdapter` abstract class → concrete adapters (`StripeAdapter`, `PayPalAdapter`, `MockPaymentAdapter`)
- `PaymentsService` uses a `Record<string, IPaymentAdapter>` registry map for provider routing
- `PaymentsController` exposes `POST /api/payments` (create), `POST /api/payments/refund`, `GET /api/payments/verify/:transactionId`, `GET /api/payments/providers`
- Individual service wrappers (`StripeService`, `PaypalService`) exist but are unused by the controller
- All adapters return simulated responses (no real gateway integration)

**Tokens Module** (`src/tokens/`)
- `TokensService` with `onModuleInit()` connecting to Stellar RPC via `@stellar/stellar-sdk` v14
- Two placeholder methods: `mintTokens(to, amount)` and `sellTokens(seller, amount, price)` — both return `{ status: 'simulated_success', ... }`
- Config includes Stellar testnet RPC URL, network passphrase, and placeholder contract IDs
- No controller, no HTTP endpoints exposed
- `sorobanConfig` is duplicated in both `src/tokens/config/` and `src/config/` (the latter is imported by `AppModule`)

**Config Module** (`src/config/`)
- `envs.ts`: Env validation (PORT, DB_PORT, DB_HOST, encryption keys, CORS origins)
- `soroban.config.ts`: Stellar testnet configuration (separate from tokens/config)
- `setup.ts`: Global pipes, Helmet, CORS with `/api` prefix

**Infrastructure**
- No database ORM installed (DB_HOST/DB_PORT in config but no TypeORM/Prisma/Mongoose dependency)
- No tests exist (zero `*.spec.ts` files, one boilerplate e2e test)
- `@stellar/stellar-sdk` 14.5.0 already installed
- `openspec/` initialized with `config.yaml` (strict_tdd: true, coverage_threshold: 80)

### Affected Areas

| Area | Impact |
|------|--------|
| `src/tokens/tokens.service.ts` | Replace placeholders with real Soroban contract invocations; add `transferTokens()`, `getBalance()` |
| `src/tokens/config/soroban.config.ts` | Add contract IDs for marketplace contracts (listing, escrow, payment split) |
| `src/tokens/tokens.module.ts` | Add controller, export for cross-module use |
| `src/config/soroban.config.ts` | Remove duplicate; consolidate in tokens config |
| `src/payments/adapters/interface/payment-adapter.interface.ts` | Reference pattern for LLM provider adapters |
| `src/payments/payments.service.ts` | Reference pattern for LLM provider service registry |
| `NEW: src/marketplace/` | Marketplace module: asset listings, publishing, purchase flow, usage tracking |
| `NEW: src/llm/` | LLM provider module: adapter pattern for OpenAI, Anthropic, etc. |
| `NEW: src/wallets/` | User wallet management: Stellar address storage, balance checks |
| `NEW: src/usage/` | Pay-per-use tracking: session recording, token deductions |
| `src/app.module.ts` | Register new modules |
| `package.json` | New deps for LLM provider SDKs (openai, @anthropic-ai/sdk, etc.) |
| `.env.example` | New vars for LLM API keys, marketplace contract IDs |
| `openspec/config.yaml` | Possibly update rules for new domains |
| `test/` | Add test suite for all new modules |

### Approaches

#### Approach 1: Monolithic Marketplace Module

One single `src/marketplace/` module containing everything: listings, LLM connections, usage tracking, wallet management. Payments and tokens remain separate.

- **Pros**: Simplest to start; no cross-module dependency issues; fast iteration
- **Cons**: Violates single responsibility; module becomes bloated; hard to test; doesn't reuse existing patterns
- **Effort**: Medium (less files but more complexity per file)

#### Approach 2: Adapter-Driven Modular with Domain Modules

Create separate modules mirroring the existing architecture:
- `src/marketplace/` — listings, assets, purchase flow
- `src/llm/` — adapter pattern for LLM providers (replicates Payments pattern)
- `src/wallets/` — user wallet management
- `src/usage/` — pay-per-use tracking, token deductions
- Improve `src/tokens/` — real Soroban contract integration

Each module has its own service/controller/interface. Marketplace orchestrates cross-module flows.

- **Pros**: Clean separation; reuses proven adapter pattern; testable in isolation; scales well
- **Cons**: More boilerplate; cross-module dependency management; needs a DI strategy for dynamic adapters
- **Effort**: High (5+ new modules, extensive wiring)

#### Approach 3: Incremental Layer — Marketplace + LLM First

Start with the two most critical new modules:
- `src/marketplace/` — listings, asset metadata, purchase flow (depends on Tokens + Payments)
- `src/llm/` — adapter pattern for LLM providers (parallel to Payments pattern)
- Wallets and usage tracking live inside marketplace initially, extracted later

Improve `src/tokens/` to support real Soroban operations (mint, transfer, balance, burn).

- **Pros**: Delivers value faster; wallets/usage can be prototyped within marketplace; less upfront boilerplate; adapter pattern proven for both payments and LLMs
- **Cons**: Wallets/usage need refactoring later if extracted; marketplace module temporarily larger
- **Effort**: Medium (3 main modules + upgrades to tokens)

### Recommendation

**Go with Approach 3 (Incremental Layer — Marketplace + LLM First).**

Why:
1. **Existing patterns are proven** — the Payments adapter pattern is already designed for extensibility. Replicating it for `src/llm/` is natural and consistent.
2. **Wallets and usage belong inside marketplace initially** — until we know the exact requirements for multi-asset support and billing tiers, premature extraction adds abstraction without value. Inline prototypes are fine.
3. **Tokens module upgrades are non-negotiable** — you can't have a token marketplace without real Soroban contract calls. The placeholders MUST be replaced regardless of approach.
4. **Delivers demonstrable work** — two new modules (marketplace + LLM) plus upgraded tokens gives a real end-to-end flow: list asset → connect LLM → pay per use → track usage.
5. **Refactoring wallet/usage out later is cheap** — NestJS modules are well-encapsulated. Extracting code from marketplace into dedicated modules later is a matter of moving providers and updating imports.

### Risks

- **No database**: The project has zero database dependencies. Usage tracking, listings, and wallet storage need persistence. In-memory storage works for prototyping but will be lost on restart. Risk: Medium. Mitigation: Use in-memory Maps for Phase 1, add a DB adapter later.
- **No Soroban contracts deployed**: The token mint/sell contracts are placeholders. Real on-chain operations require deploying Soroban contracts to testnet. Risk: High. Mitigation: Deploy contracts as a prerequisite task; use the simulated fallback only for local dev.
- **Stellar transaction signing**: Admin key management and user signing flows are complex. The current config has an `adminSecretKey` placeholder but no signing logic. Risk: High. Mitigation: Start with admin-signed transactions; add user wallet signing in later iterations.
- **LLM provider costs**: If the system connects to real LLM APIs during development, API costs accrue. Risk: Low (testing only).
- **No test coverage**: Zero tests exist. New code won't be tested unless enforced. Risk: High. Mitigation: The openspec config already has `strict_tdd: true` and `coverage_threshold: 80`. Enforce this from day one.
- **Duplicated soroban config**: `src/tokens/config/soroban.config.ts` and `src/config/soroban.config.ts` both exist. Risk: Low. Mitigation: Consolidate into one.

### Ready for Proposal

**Yes.** The scope is clear, the architecture patterns are established, and the risks are understood. Move to `sdd-propose` for the token-marketplace change.
