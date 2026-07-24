# ADR 003: Encrypted Off-Chain Prompt Delivery Guarantees

## Status
Accepted

## Context
The Smart-contracts repository handles the financial and verification aspects of prompts, but it cannot validate backend-side behavior such as logs, caches, telemetry, prompt execution, provider retention, or key handling. To protect user privacy and prevent data leakage or unauthorized replays, the backend needs strict, verifiable guarantees when processing encrypted off-chain prompts.

## Decision
We have implemented a dedicated `prompt-delivery` module that orchestrates the decryption and execution of prompts with the following architectural constraints:

### 1. Key Lifecycle & Envelope Encryption
- **No Master Keys in Plaintext:** The backend never receives or stores master keys.
- **Envelope Encryption:** The system uses a Data Encryption Key (DEK) wrapped by a Key Encryption Key (KEK) managed by a KMS.
- **Memory Zeroing:** The `KeyManagerService` is responsible for fetching the DEK. Once the prompt is decrypted and executed, the buffer holding the DEK in plaintext is immediately explicitly overwritten with zeroes (`Buffer.fill(0)`) to ensure it is purged from RAM instantly.

### 2. Idempotency & Replay Protection
- **Canonical Identifier:** To prevent Replay Attacks, we do not rely solely on the transaction hash. A single transaction might emit multiple events.
- We use a composite canonical identifier: `network:transaction_hash:contract_id:event_index`.
- The `ReplayGuardService` guarantees that any event matching an already processed identifier is aggressively blocked and rejected before any decryption or provider interaction occurs.

### 3. Logs, Telemetry & Traces Privacy
- **Privacy Logger:** A custom `PrivacyLogger` extends the default NestJS logger. It intercepts all output streams.
- **Redaction:** Any Base64 strings, cryptographic keys, or variables explicitly marked as sensitive are replaced with the `[REDACTED]` tag. Plaintext prompts are strictly prevented from entering the standard output or telemetry systems.

### 4. AI Provider Behavior
- **Data Retention Flags:** The `AiProviderService` uses an adapter pattern (`IAiProviderAdapter`) for integrating providers (e.g., OpenAI, Claude). 
- All outgoing HTTP requests to these providers must enforce zero-retention policies via API flags (e.g., `data_sharing: false`, or utilizing enterprise endpoints that guarantee zero retention) to ensure user prompts are not used for model training or stored on third-party servers.

## Consequences
- **High Privacy:** User prompts are decrypted only in memory for a fraction of a millisecond and are never logged or stored on disk.
- **Auditable Flow:** The architecture is decoupled into explicit services (`KeyManager`, `ReplayGuard`, `PrivacyLogger`) making it easy to unit test each guarantee individually.
- **Future Integrations:** Any new AI provider integration must implement the `IAiProviderAdapter` interface, which mandates handling the non-retention flags.
