import { User } from '../models/user.interface';

export interface UserRepository {
  findOrCreate(publicKey: string): User;
  findByPublicKey(publicKey: string): User | null;
  updateLastLogin(publicKey: string): User | null;
}
