# ADR 004: Curated Prompt Publication State

## Status
Accepted

## Decision

Curated publication is a durable state machine, not a status field. A `prompt_publications` row carries one PROMPT asset through `DRAFT -> PENDING_REVIEW -> PUBLISHING -> PUBLISHED/FAILED`, with `PUBLISHED` terminal and `FAILED -> PUBLISHING` as the only retry edge. The row holds lifecycle, price binding and on-chain evidence. It never holds prompt content; encryption, commitment generation and Testnet registration land in follow-up work units and write into columns this migration reserves.

Publication state lives in its own table and its own `prompt_publication_state_enum`, not as new values on `assets_status_enum`. PostgreSQL refuses to use a value added by `ALTER TYPE ... ADD VALUE` inside the transaction that adds it, and TypeORM wraps every migration in one. Extending the shared enum would also change what `AssetsService.findPublished()` means for every other asset type. The enum name is pinned with `enumName` and uniqueness is declared as named indexes rather than table constraints, because development and CI run with `DB_SYNCHRONIZE=true` — the entity, not the migration, builds the schema there, and an unpinned name would let CI and a migrated deployment diverge without any test noticing.

Price is bound once, at creation, as `numeric(39,0)` held as a string. `assets.price` is `decimal(20,2)` and cannot carry an atomic-unit `i128` value; a JavaScript number cannot represent the range exactly. A `CHECK` restates the contract's own preconditions — `price > 0` and the `i128` upper bound — so a value the contract would reject can never reach it.

Idempotency is enforced by the database and by conditional updates, never by application bookkeeping. Every transition is `UPDATE ... WHERE id = :id AND state = :from` with an `affected === 1` assertion, so two concurrent approvals cannot both advance a row. Partial unique indexes on `commitment` and `transactionHash` make a second contract record for the same commitment impossible. A `CHECK` makes `PUBLISHED` unreachable unless commitment, contract ID, transaction hash and ledger sequence are all present, so the acceptance criterion holds even against a future caller that skips the service layer. `register_private_prompt` panics on a commitment that is already registered, so a retry must replay the same row rather than create a second one — which is what the `FAILED -> PUBLISHING` edge and the write-once binding guarantee.

Authorization is split between the asset creator and a curated-market operator. The codebase has no role model, so operators are a configured allowlist of Stellar public keys, validated at boot and fail-closed: an unset or empty list authorizes nobody. This is explicitly a placeholder for a role model, not a design endorsement of allowlists.

## Security limitations

- Prompt content, salts and key material are absent from this table by construction, not by redaction. The encrypted-ingestion work unit must keep them out of it.
- Reviewer free text is stored in `failureDetail` and is not returned by the publication response DTO, but nothing prevents a reviewer from pasting prompt content into it. Operator guidance, not a schema control.
- The operator allowlist is configuration. Anyone who can change environment variables can grant themselves review rights; that is the same trust boundary as `STELLAR_ADMIN_SECRET_KEY`.
- `PUBLISHED` asserts that evidence was recorded, not that the evidence was verified against the ledger. Verifying that the registration event matches the recorded owner and price is the Testnet registration work unit's responsibility.
- The contract exposes `has_private_access` but no getter for a registered private prompt, so "matching owner and price" can only be checked against the `private_prompt_registered_v1` event of the registration transaction.
