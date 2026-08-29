# Wallet Authentication Specification

## Purpose

Wallet-based authentication using Stellar keypair challenge-response. Covers challenge generation, signature verification via `Keypair.verify()`, JWT issuance, and JWT validation for protected `/api/*` routes.

## Requirements

### Requirement: Challenge Generation

The system MUST provide `POST /auth/challenge` that generates a unique challenge per Stellar `publicKey`. Each challenge MUST be cached with a configurable TTL and MUST be single-use (consumed upon successful verification).

| Property | Rule |
|----------|------|
| Method | POST |
| Path | /auth/challenge |
| Request body | `{ publicKey: string }` |
| Success | `200 { challenge: string }` |
| Validation error | `400 { message, error }` |

#### Scenario: Generate challenge for valid publicKey

- GIVEN a valid Stellar `publicKey`
- WHEN the client sends `POST /auth/challenge` with that `publicKey`
- THEN the system returns `200` with a unique `challenge` string
- AND the challenge is cached for that `publicKey` with a short TTL

#### Scenario: Reject malformed publicKey

- GIVEN a `publicKey` that is not a valid Stellar account ID
- WHEN the client sends `POST /auth/challenge` with it
- THEN the system returns `400`

#### Scenario: Return cached challenge within TTL

- GIVEN a cached challenge exists for the `publicKey` and has NOT expired
- WHEN the client requests a new challenge for the same `publicKey`
- THEN the system SHOULD return the existing cached challenge

### Requirement: Wallet Verification

The system MUST provide `POST /auth/wallet` that verifies a Stellar-signed challenge, upserts the user record, and issues a JWT with `{ publicKey, iat }` payload.

| Property | Rule |
|----------|------|
| Method | POST |
| Path | /auth/wallet |
| Request body | `{ publicKey: string, signature: string }` |
| Success | `200 { accessToken: string }` |
| Auth error | `401 { message, error }` |

#### Scenario: Valid signature upserts user and returns JWT

- GIVEN a cached challenge exists for the `publicKey`
- AND a signature produced by the corresponding Stellar keypair over that challenge
- WHEN the client sends `POST /auth/wallet` with `{ publicKey, signature }`
- THEN the system returns `200` with `{ accessToken }`
- AND the JWT payload MUST contain `{ publicKey, iat }`

#### Scenario: Invalid signature returns 401

- GIVEN a cached challenge exists for the `publicKey`
- WHEN the client sends an invalid signature
- THEN the system returns `401` with error detail

#### Scenario: Missing or expired challenge returns 401

- GIVEN no cached challenge exists for the `publicKey` (or TTL expired)
- WHEN the client sends `POST /auth/wallet`
- THEN the system returns `401`

#### Scenario: Replay of consumed challenge returns 401

- GIVEN a challenge was successfully verified and consumed
- WHEN the client sends the same `{ publicKey, signature }` pair again
- THEN the system returns `401`

### Requirement: JWT Validation

The system MUST use a `JwtAuthGuard` (via passport-jwt Bearer strategy) on protected routes. The strategy MUST extract the token from the `Authorization: Bearer <token>` header.

#### Scenario: Valid token grants access to protected route

- GIVEN a valid JWT issued by the system
- WHEN the client sends a request with `Authorization: Bearer <token>`
- THEN the request proceeds and `request.user` contains `{ publicKey }`

#### Scenario: Missing token returns 401

- GIVEN no `Authorization` header
- WHEN the client sends a request to a protected route
- THEN the system returns `401`

#### Scenario: Expired or malformed token returns 401

- GIVEN a JWT that is expired or has invalid signature
- WHEN the client sends it as Bearer token
- THEN the system returns `401`

### Requirement: Wallet Data Authorization

The system MUST derive the wallet identity for private wallet data and mutations solely from the authenticated principal. Wallet routes MUST NOT accept a wallet identifier in a path, query or body parameter.

| Route | Auth | Notes |
|-------|------|-------|
| GET /wallet/balance | JWT required | Scoped to `request.user.publicKey` |
| GET /wallet/transactions | JWT required | Scoped to `request.user.publicKey` |
| POST /wallet/purchase | JWT required | Returns `501` while unsupported |
| GET /wallet/packages | Public | Catalogue and capability only, no wallet state |

#### Scenario: Unauthenticated wallet data request returns 401

- GIVEN no `Authorization` header
- WHEN the client requests wallet balance, transactions, or purchase
- THEN the system returns `401`
- AND no wallet is read or written

#### Scenario: A request parameter cannot select another wallet

- GIVEN a valid JWT for wallet A
- WHEN the client sends `GET /wallet/balance?user=<wallet B>`
- THEN the system returns data for wallet A
- AND the parameter is ignored

#### Scenario: Reading a balance does not create a wallet

- GIVEN an authenticated principal with no wallet row
- WHEN the client requests `GET /wallet/balance`
- THEN the system returns `credits: 0` and the `monthlyAllocation` column default
- AND no wallet row is persisted

#### Scenario: Paging values cannot reach the query builder unsanitised

- GIVEN an authenticated principal
- WHEN the client sends a `limit` or `skip` that is not a finite number
- THEN the system MUST substitute the documented default rather than returning `500`
- AND `limit` MUST be clamped to the range 1..100

### Requirement: No Fabricated Money

The system MUST NOT present a simulated balance, currency estimate, or transaction identifier as real money activity.

#### Scenario: On-chain balance is reported as unavailable

- GIVEN no verified Stellar balance source is integrated
- WHEN the client requests `GET /wallet/balance`
- THEN `onChain.status` MUST be `UNAVAILABLE` with reason `STELLAR_BALANCE_NOT_INTEGRATED`
- AND `onChain.xlmBalance` and `onChain.xlmUsdEstimate` MUST be `null`, never `0`

#### Scenario: A non-hash transaction identifier is not presented as on-chain

- GIVEN a stored `txid` that is not a 64-character lowercase hex Stellar transaction hash
- WHEN the client requests `GET /wallet/transactions`
- THEN `ledgerReference` MUST be `null` for that row

### Requirement: Credit Purchase Capability

The system MUST advertise whether credit packages can be purchased, so a client can hide the action before a user clicks it.

#### Scenario: Capability is discoverable without authentication

- GIVEN credit purchase is unsupported
- WHEN the client requests `GET /wallet/packages`
- THEN `purchase.supported` MUST be `false`
- AND `purchase.reason` MUST be `CREDIT_PURCHASE_NOT_AVAILABLE`
- AND every package MUST carry `purchasable: false`

#### Scenario: Posting a purchase anyway returns 501

- GIVEN an authenticated principal
- WHEN the client sends `POST /wallet/purchase`
- THEN the system returns `501` with `message` equal to `CREDIT_PURCHASE_NOT_AVAILABLE`
- AND no credits, balance, or transaction row are written

### Requirement: Simulated Payments Fail Closed

Development fallbacks MUST be gated by an allowlist of `NODE_ENV` values (`development`, `test`). Any other value, including `staging` or an unset variable, MUST be treated as a real deployment.

#### Scenario: A real deployment refuses to boot with simulation enabled

- GIVEN `NODE_ENV` is not `development` or `test`
- AND any of `PAYMENT_SIMULATION_ENABLED`, `MOCK_PAYMENT_ENABLED`, `MOCK_PAYMENT_FAIL`
  or `DB_SEED_ON_STARTUP` is enabled
- WHEN the application starts
- THEN environment validation MUST throw and the process MUST exit non-zero

#### Scenario: Development defaults do not apply to an unrecognised environment

- GIVEN `NODE_ENV` is not `development` or `test`
- WHEN the application starts
- THEN `DB_SYNCHRONIZE` MUST default to `false`
- AND `CORS_ORIGINS` MUST NOT be permitted to be `*`
- AND Swagger MUST stay disabled unless `SWAGGER_ENABLED` is explicitly `true`

#### Scenario: A real deployment requires an explicit JWT signing key

- GIVEN `NODE_ENV` is not `development` or `test`
- AND `JWT_SECRET` is unset
- WHEN the application starts
- THEN environment validation MUST throw, because the `dev-secret` fallback would let any caller mint a token for any wallet

#### Scenario: A configured credential does not enable fabrication

- GIVEN payment simulation is disabled
- AND `STRIPE_API_KEY` or the PayPal credentials are set
- WHEN a payment, refund, or verification is requested
- THEN the adapter MUST return `success: false`
- AND MUST NOT invent a transaction identifier

### Requirement: User Record

The system MUST maintain a `User` entity for each authenticated wallet.

| Field | Type | Constraints |
|-------|------|-------------|
| publicKey | string | Primary Key, unique, required |
| status | UserStatus | Enum: `ACTIVE` / `SUSPENDED`; default `ACTIVE` |
| displayName | string | Default `''`, never null |
| avatar | string | Default `''`, never null |
| createdAt | Date | Auto-set on creation, immutable |
| lastLoginAt | Date | Updated on each successful verification |

#### Scenario: Create user on first successful verification

- GIVEN a `publicKey` that does NOT exist in the database
- AND a successful wallet verification
- WHEN the system processes the verification
- THEN a new `User` is created with `publicKey`, `createdAt`, and `lastLoginAt` set to current time

#### Scenario: Update lastLoginAt on subsequent verifications

- GIVEN an existing `User` for the `publicKey`
- AND a successful wallet verification
- WHEN the system processes the verification
- THEN the user's `lastLoginAt` is updated to the current timestamp
- AND `createdAt` MUST remain unchanged

#### Scenario: displayName and avatar default to empty strings

- GIVEN a `publicKey` that does NOT exist in the database
- WHEN a user is created via wallet verification
- THEN `displayName` and `avatar` MUST be `''` (empty string), never null
