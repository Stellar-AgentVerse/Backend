export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export interface User {
  publicKey: string;
  status: UserStatus;
  displayName: string;
  avatar: string;
  createdAt: Date;
  lastLoginAt: Date;
}
