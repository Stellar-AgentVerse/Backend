import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DeliveryState {
  RECEIVED = 'RECEIVED',
  AUTHORIZED = 'AUTHORIZED',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  RETRYABLE_FAILURE = 'RETRYABLE_FAILURE',
  TERMINAL_FAILURE = 'TERMINAL_FAILURE',
  EXPIRED = 'EXPIRED',
  DEAD_LETTERED = 'DEAD_LETTERED',
}

@Entity('delivery_commands')
@Index(['canonicalId'], { unique: true })
@Index(['state', 'nextAttemptAt'])
export class DeliveryCommandEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64 }) canonicalId: string;
  @Column({ type: 'text' }) canonicalJson: string;
  @Column({ type: 'smallint' }) version: number;
  @Column({ type: 'varchar', length: 100 }) network: string;
  @Column({ type: 'varchar', length: 56 }) contractId: string;
  @Column({ type: 'varchar', length: 128 }) transactionHash: string;
  @Column({ type: 'bigint' }) ledgerSequence: number;
  @Column({ type: 'integer' }) eventIndex: number;
  @Column({ type: 'uuid' }) purchaseId: string;
  @Column({ type: 'uuid' }) assetId: string;
  @Column({ type: 'varchar', length: 56 }) buyerPublicKey: string;
  @Column({ type: 'varchar', length: 128 }) tenantId: string;
  @Column({ type: 'varchar', length: 64 }) providerName: string;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'text' }) wrappedDek: string;
  @Column({ type: 'text' }) encryptedPrompt: string;
  @Column({
    type: 'enum',
    enum: DeliveryState,
    default: DeliveryState.RECEIVED,
  })
  state: DeliveryState;
  @Column({ type: 'integer', default: 0 }) attempts: number;
  @Column({ type: 'timestamptz', nullable: true }) leaseUntil: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) nextAttemptAt: Date | null;
  @Column({ type: 'varchar', length: 80, nullable: true }) failureCode:
    | string
    | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updatedAt: Date;
}
