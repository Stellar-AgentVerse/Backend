# Tasks: Unit Tests — all modules

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 8 commits in sequence |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Assets specs | PR 1 | Standalone controller/service coverage |
| 2 | Wallet specs | PR 2 | Standalone controller/service coverage |
| 3 | Dashboard specs + DTO extraction | PR 3 | Extract inline DTOs first, then test |
| 4 | Marketplace specs + DTO extraction | PR 4 | Extract inline DTOs first, then test |
| 5 | Payments controller + service specs | PR 5 | Mock adapters via service injection |
| 6 | Payments adapters specs | PR 6 | Stripe/PayPal/Mock adapter behavior |
| 7 | Indexer + Tokens specs | PR 7 | QueryBuilder + Stellar SDK mocking |
| 8 | Config/setup + database/seed specs | PR 8 | App setup + seed early-return flow |

## Phase 1: Assets + Wallet

- [ ] 1.1 Add `src/assets/assets.controller.spec.ts` and `src/assets/assets.service.spec.ts` covering types/tags/list/mine/getById/create and slug-collision behavior.
- [ ] 1.2 Add `src/wallet/wallet.controller.spec.ts` and `src/wallet/wallet.service.spec.ts` covering balance/packages/transactions/purchase and wallet auto-creation.

## Phase 2: DTO Extraction + Dashboard/Marketplace

- [ ] 2.1 Extract dashboard inline DTOs from `src/dashboard/dashboard.service.ts` into `src/dashboard/dto/*.ts` and update imports.
- [ ] 2.2 Add `src/dashboard/dashboard.controller.spec.ts` and `src/dashboard/dashboard.service.spec.ts` for aggregates, top assets, and activity time formatting.
- [ ] 2.3 Extract marketplace inline DTOs from `src/marketplace/marketplace.service.ts` into `src/marketplace/dto/*.ts` and update imports.
- [ ] 2.4 Add `src/marketplace/marketplace.controller.spec.ts` and `src/marketplace/marketplace.service.spec.ts` for search, featured, trending, and categories.

## Phase 3: Payments Coverage

- [ ] 3.1 Add `src/payments/payments.controller.spec.ts` and `src/payments/payments.service.spec.ts` covering provider routing, missing-provider errors, and verify/refund paths.
- [ ] 3.2 Add `src/payments/adapters/stripe.adapter.spec.ts`, `src/payments/adapters/paypal.adapter.spec.ts`, and `src/payments/adapters/mock-payment.adapter.spec.ts` for configured/unconfigured success and error flows.

## Phase 4: Indexer + Tokens

- [ ] 4.1 Add `src/indexer/indexer.service.spec.ts` with QueryBuilder mocks for record/query/total-consumed cases.
- [ ] 4.2 Add `src/tokens/tokens.service.spec.ts` mocking `@stellar/stellar-sdk` and asserting `onModuleInit()` plus mint/sell contract guard paths.

## Phase 5: Config + Seed

- [ ] 5.1 Add `src/config/setup.spec.ts` for `setupApp`, `setupValidation`, `setupHelmet`, and `setupCors` (allow-all and allowlist callback branches).
- [ ] 5.2 Add `src/database/seed.spec.ts` for skip-path and full-seed-path behavior using a mocked `DataSource`.
