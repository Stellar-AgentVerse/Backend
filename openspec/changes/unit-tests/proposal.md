# Proposal: Unit Tests — all modules

## Intent

Add unit test coverage to every untested module in the NestJS backend to meet Strict TDD standards (enforced in `openspec/config.yaml`) and improve code reliability. Currently only `auth` has tests — 6 modules have zero coverage.

## Scope

### In Scope
- **assets**: `AssetsController` + `AssetsService` specs (mock 6 TypeORM repositories)
- **wallet**: `WalletController` + `WalletService` specs (mock 3 TypeORM repositories)
- **dashboard**: `DashboardController` + `DashboardService` specs (mock 3 repositories). Extract inline DTOs into dedicated DTO file.
- **marketplace**: `MarketplaceController` + `MarketplaceService` specs (mock 2 repositories, use QueryBuilder). Extract inline DTOs into dedicated DTO file.
- **payments**: `PaymentsService` + `PaymentsController` specs (mock StripeAdapter, PayPalAdapter). `StripeAdapter` + `PayPalAdapter` + `MockPaymentAdapter` adapter unit specs.
- **indexer**: `IndexerService` spec (mock 1 repository + QueryBuilder)
- **tokens**: `TokensService` spec (mock `@stellar/stellar-sdk` and soroban config injection token)
- **config/setup**: `setupApp` / `setupValidation` / `setupCors` / `setupHelmet` specs (mock `INestApplication`)
- **database/seed**: `seedDatabase` spec (mock `DataSource`)

### Out of Scope
- E2E tests — separate phase
- Integration tests — not required at this stage
- Business logic changes — only test files and DTO extraction, zero production code refactoring
- New features — no functional additions
- `health` controller — already has a spec

## Capabilities

> No spec-level changes — this is pure test addition and DTO extraction. No new or modified capabilities.

### New Capabilities
None

### Modified Capabilities
None

## Approach

1. Follow existing `auth` test patterns: `Test.createTestingModule`, manual mocks via `jest.Mocked<>`, `jest.mock()` for external packages.
2. Mock TypeORM repositories via `mockRepository()` helper pattern (provide value objects, not `useClass`).
3. Mock `@stellar/stellar-sdk` at module level with `jest.mock()` (same approach as `auth`).
4. Extract inline DTO interfaces from `dashboard.service.ts` and `marketplace.service.ts` into their own `dto/` directories.
5. Each spec covers: success paths, error/404 paths, empty-state paths, and edge cases.
6. Run `npm test` after each module — all new specs must pass.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/assets/` | New | 2 spec files (controller + service) |
| `src/wallet/` | New | 2 spec files (controller + service) |
| `src/dashboard/` | New + Modified | 2 spec files + DTO extraction to `dto/` |
| `src/marketplace/` | New + Modified | 2 spec files + DTO extraction to `dto/` |
| `src/payments/` | New | 5 spec files (service, controller, 3 adapters) |
| `src/indexer/` | New | 1 spec file (service) |
| `src/tokens/` | New | 1 spec file (service) |
| `src/config/` | New | 1 spec file (setup) |
| `src/database/` | New | 1 spec file (seed) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stellar SDK mock breaks with version changes | Low | Follow existing `auth` pattern — mock only used interface |
| TypeORM QueryBuilder hard to mock | Medium | Use `createQueryBuilder` mock returning chained mock object |
| DTO extraction breaks imports | Low | Update all internal imports in controller + service files |

## Rollback Plan

- Revert spec files: `git rm` any new `*.spec.ts` and restore modified files
- Revert DTO extractions: restore original service files, remove `dto/` directories

## Dependencies

- None — all packages already in `devDependencies` (`@nestjs/testing`, `jest`, `ts-jest`)

## Success Criteria

- [ ] `npm test` passes with all new specs
- [ ] Coverage rises from ~0% (excluding auth) to >60% for modules with tests
- [ ] DTO extraction does not break existing controllers (checked via `npm run build`)
- [ ] At minimum 2 test cases per service method (success + error)
