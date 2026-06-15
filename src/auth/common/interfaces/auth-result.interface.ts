import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../models/user.interface';

export class AuthResult {
  @ApiProperty()
  token: string;
  @ApiProperty({ type: User })
  user: User;
}
