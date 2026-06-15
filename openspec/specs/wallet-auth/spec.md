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
