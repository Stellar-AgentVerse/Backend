# Prompt Delivery Runbook

## Configuration

Set `AWS_REGION`, `AWS_KMS_KEY_ID`, `DB_*`, the Stellar network, and the configured marketplace contract. Production must use workload identity with only KMS encrypt/decrypt permissions for the delivery key and database access required by the worker.

## Incidents

- **Queue lag/outage:** inspect `delivery_commands` for `AUTHORIZED` and `RETRYABLE_FAILURE`; restore worker capacity. Do not manually reset `SUCCEEDED` rows.
- **KMS outage:** retryable failures back off automatically. Do not copy wrapped keys or plaintext into tickets.
- **Provider outage:** inspect failure codes and provider status. Retry only retryable states; use the canonical idempotency key when reconciling ambiguous calls.
- **Poison message:** after five attempts the command is dead-lettered. Validate the event and envelope, then either correct the upstream event or record a terminal reconciliation decision.
- **Authentication failure:** treat as tampering or wrong context. Do not retry blindly; investigate the canonical command and tenant/buyer binding without exposing payloads.
- **Expiration:** expired commands/results are not executable/retrievable. Apply the configured deletion job to ciphertext and metadata according to retention policy.
- **Key rotation:** deploy the new KMS key version, accept both configured decrypt versions during migration, and re-encrypt only through an audited job. Never export DEKs.

## Investigation rules

Use correlation IDs, canonical command IDs, state transitions, attempt counts, and provider request IDs. Logs must remain redacted. Never log prompts, responses, envelope fields, XDR, credentials, KMS ciphertext, or bearer tokens.
