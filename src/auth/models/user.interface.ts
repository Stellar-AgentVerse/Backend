import { ApiProperty } from '@nestjs/swagger';

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export class User {
  @ApiProperty()
  publicKey: string;
  @ApiProperty({ enum: UserStatus })
  status: UserStatus;
  @ApiProperty()
  displayName: string;
  @ApiProperty()
  avatar: string;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  lastLoginAt: Date;
}
