import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { AssetType } from './asset-type.enum';

export enum AssetStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

@Entity('assets')
@Index(['creatorPublicKey', 'status'])
@Index(['type', 'status'])
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 200, unique: true })
  slug: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'enum', enum: AssetType })
  type: AssetType;

  @Column({ type: 'varchar', length: 56 })
  @Index()
  creatorPublicKey: string;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'enum', enum: AssetStatus, default: AssetStatus.DRAFT })
  status: AssetStatus;

  @Column({ type: 'varchar', length: 500, default: '' })
  imageUrl: string;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
