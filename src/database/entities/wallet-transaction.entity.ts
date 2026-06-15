import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum TransactionType {
  PURCHASE = 'PURCHASE',
  INCOME = 'INCOME',
  FEE = 'FEE',
  REFILL = 'REFILL',
}

@Entity('wallet_transactions')
@Index(['walletId', 'createdAt'])
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  walletId: string;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'varchar', length: 300 })
  description: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  txid: string;

  @Column({ type: 'decimal', precision: 20, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 20, default: 'Credits' })
  currency: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
