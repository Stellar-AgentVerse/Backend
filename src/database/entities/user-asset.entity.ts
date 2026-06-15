import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum UserAssetRole {
  CREATOR = 'CREATOR',
  FOLLOWER = 'FOLLOWER',
}

@Entity('user_assets')
@Index(['userPublicKey', 'assetId'], { unique: true })
export class UserAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 56 })
  userPublicKey: string;

  @Column({ type: 'uuid' })
  assetId: string;

  @Column({ type: 'enum', enum: UserAssetRole, default: UserAssetRole.FOLLOWER })
  role: UserAssetRole;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
