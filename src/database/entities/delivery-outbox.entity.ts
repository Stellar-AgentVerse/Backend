import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('delivery_outbox')
@Index(['publishedAt', 'availableAt'])
export class DeliveryOutboxEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) commandId: string;
  @Column({ type: 'varchar', length: 64 }) canonicalId: string;
  @Column({ type: 'integer', default: 0 }) attempts: number;
  @Column({ type: 'timestamptz', nullable: true }) publishedAt: Date | null;
  @Column({ type: 'timestamptz', default: () => 'now()' }) availableAt: Date;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
