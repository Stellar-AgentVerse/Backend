import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PurchaseStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
}

@Entity('purchases')
@Index(['buyerPublicKey', 'status'])
@Index(['buyerPublicKey', 'idempotencyKey'], { unique: true })
@Index(['transactionHash'], {
  unique: true,
  where: '"transactionHash" IS NOT NULL',
})
@Index(['assetId', 'buyerPublicKey'])
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  assetId: string;

  @Column({ type: 'varchar', length: 56 })
  buyerPublicKey: string;

  @Column({
    type: 'enum',
    enum: PurchaseStatus,
    default: PurchaseStatus.PENDING,
  })
  status: PurchaseStatus;

  @Column({ type: 'varchar', length: 64 })
  idempotencyKey: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  transactionHash: string | null;

  @Column({ type: 'varchar', length: 56 })
  contractId: string;

  @Column({ type: 'varchar', length: 100 })
  networkPassphrase: string;

  @Column({ type: 'decimal', precision: 20, scale: 2 })
  amount: number;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
