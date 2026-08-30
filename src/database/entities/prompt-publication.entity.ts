import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PromptPublicationState {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  PUBLISHING = 'PUBLISHING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

/**
 * Largest value representable by the `i128` price argument of
 * `PromptMarketplace::register_private_prompt`.
 */
export const MAX_ATOMIC_PRICE = 170141183460469231731687303715884105727n;

/**
 * Curated publication record for a single PROMPT asset.
 *
 * The row carries the publication lifecycle and the on-chain evidence, never
 * prompt content. Content encryption and commitment generation land in a
 * follow-up work unit; the columns are reserved here so the state machine and
 * its constraints exist before anything can write to them.
 */
@Entity('prompt_publications')
@Index('UX_prompt_publications_asset', ['assetId'], { unique: true })
@Index('IDX_prompt_publications_work', ['state', 'updatedAt'])
@Index('UX_prompt_publications_commitment', ['commitment'], {
  unique: true,
  where: '"commitment" IS NOT NULL',
})
@Index('UX_prompt_publications_tx', ['transactionHash'], {
  unique: true,
  where: '"transactionHash" IS NOT NULL',
})
export class PromptPublication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * One publication per asset. Uniqueness is declared as a named index rather
   * than a column constraint so the entity and the migration produce the same
   * database object under `synchronize` and under `migration:run`.
   */
  @Column({ type: 'uuid' })
  assetId: string;

  /**
   * `enumName` is pinned on purpose. Development and CI run with
   * `DB_SYNCHRONIZE=true`, so the entity — not the migration — creates the
   * type there. Without an explicit name TypeORM would emit
   * `prompt_publications_state_enum` while the migration emits
   * `prompt_publication_state_enum`, and the two environments would diverge
   * silently.
   */
  @Column({
    type: 'enum',
    enum: PromptPublicationState,
    enumName: 'prompt_publication_state_enum',
    default: PromptPublicationState.DRAFT,
  })
  state: PromptPublicationState;

  /**
   * Immutable price in atomic units, mirroring the contract's `i128` argument.
   * Held as a string because `numeric(39,0)` exceeds the exact-integer range of
   * a JavaScript number.
   */
  @Column({ type: 'numeric', precision: 39, scale: 0 })
  priceAtomic: string;

  @Column({ type: 'smallint', default: 1 })
  commitmentVersion: number;

  /** Lowercase hex SHA-256 commitment. Written by the ingestion work unit. */
  @Column({ type: 'char', length: 64, nullable: true })
  commitment: string | null;

  @Column({ type: 'varchar', length: 32 })
  network: string;

  @Column({ type: 'varchar', length: 56, nullable: true })
  contractId: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  transactionHash: string | null;

  /** `bigint` is returned as a string by the pg driver. */
  @Column({ type: 'bigint', nullable: true })
  ledgerSequence: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'varchar', length: 56, nullable: true })
  reviewerPublicKey: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  failureCode: string | null;

  @Column({ type: 'text', nullable: true })
  failureDetail: string | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
