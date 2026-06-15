import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 56, unique: true })
  @Index()
  userPublicKey: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  credits: number;

  @Column({ type: 'decimal', precision: 20, scale: 7, default: 0 })
  xlmBalance: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  monthlyUsage: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 100 })
  monthlyAllocation: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
