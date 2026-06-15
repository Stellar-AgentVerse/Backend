import { User, UserStatus } from './user.interface';

export class UserEntity implements User {
  publicKey: string;
  status: UserStatus;
  displayName: string;
  avatar: string;
  createdAt: Date;
  lastLoginAt: Date;

  constructor(publicKey: string) {
    this.publicKey = publicKey;
    this.status = UserStatus.ACTIVE;
    this.displayName = '';
    this.avatar = '';
    this.createdAt = new Date();
    this.lastLoginAt = new Date();
  }
}
