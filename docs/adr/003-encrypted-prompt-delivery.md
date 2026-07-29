# ADR 003: Durable Encrypted Prompt Delivery

## Status
Accepted

## Decision

Prompt delivery is an authorization and integrity boundary. A delivery command is accepted only from the verified purchase-event adapter and is identified by a SHA-256 digest of its versioned canonical JSON. PostgreSQL uniqueness and row leases, not process memory, control replay and concurrent workers.

Commands move through `RECEIVED`, `AUTHORIZED`, `PROCESSING`, `SUCCEEDED`, retryable/terminal failure, `EXPIRED`, and `DEAD_LETTERED`. The outbox/worker boundary provides crash recovery. External provider calls use the canonical digest as their idempotency key. This is an effective-once guarantee: a crash after an external call and before persistence can cause an ambiguous duplicate request; operators reconcile that case using the provider idempotency key and delivery record.

Prompt and result envelopes use version 1 AES-256-GCM, fresh 12-byte nonces, strict size limits, and canonical command metadata as AAD. AWS KMS decrypt/encrypt operations use an explicit context containing tenant, buyer, purchase, and canonical command identifiers. Authentication failures are terminal and intentionally expose no oracle detail.

Provider adapters are injected because retention, cancellation, and idempotency guarantees are provider-specific. The backend persists only encrypted result payloads and operational metadata. JWT retrieval is buyer-bound and never starts execution.

## Security limitations

- Plaintext and key buffers are zeroed on controllable paths. Node.js strings, garbage collection, provider SDK internals, crash dumps, and process memory snapshots cannot be perfectly erased or controlled by this application.
- No anonymity from payment metadata is claimed.
- No plaintext prompts/results or DEKs are written to persistence, logs, traces, metrics, or error responses.
