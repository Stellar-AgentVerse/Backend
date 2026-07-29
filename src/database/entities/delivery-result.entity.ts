import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('delivery_results')
@Index(['canonicalId'], { unique: true })
@Index(['purchaseId'], { unique: true })
export class DeliveryResultEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 64 }) canonicalId: string;
  @Column({ type: 'uuid' }) commandId: string;
  @Column({ type: 'uuid' }) purchaseId: string;
  @Column({ type: 'varchar', length: 56 }) buyerPublicKey: string;
  @Column({ type: 'varchar', length: 128 }) tenantId: string;
  @Column({ type: 'jsonb' }) encryptedResult: Record<string, string | number>;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}
