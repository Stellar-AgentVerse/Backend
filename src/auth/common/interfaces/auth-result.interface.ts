import { User } from '../../models/user.interface';

export interface AuthResult {
  token: string;
  user: User;
}
