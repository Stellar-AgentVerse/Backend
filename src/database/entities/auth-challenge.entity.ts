import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('auth_challenges')
@Index(['expiresAt'])
export class AuthChallenge {
  @PrimaryColumn({ type: 'varchar', length: 56 })
  publicKey!: string;

  @Column({ type: 'varchar', length: 128 })
  challenge!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;
}
