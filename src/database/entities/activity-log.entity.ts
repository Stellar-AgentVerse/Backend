import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('activity_logs')
@Index(['assetId', 'createdAt'])
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  assetId: string | null;

  @Column({ type: 'varchar', length: 100 })
  event: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  asset: string;

  @Column({ type: 'varchar', length: 50, default: 'Active' })
  status: string;

  @Column({ type: 'varchar', length: 50, default: '--' })
  revenue: string;

  @Column({ type: 'varchar', length: 56, nullable: true })
  @Index()
  userPublicKey: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
