import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('credit_packages')
export class CreditPackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  description: string;

  @Column({ type: 'varchar', length: 64 })
  icon: string;

  @Column({ type: 'integer' })
  credits: number;

  @Column({ type: 'decimal', precision: 20, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 20, scale: 2, nullable: true })
  originalPrice: number | null;

  @Column({ type: 'jsonb', nullable: true })
  features: string[] | null;

  @Column({ type: 'boolean', default: false })
  popular: boolean;

  @Column({ type: 'integer', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
