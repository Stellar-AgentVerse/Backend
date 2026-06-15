import { User } from '../models/user.interface';

export interface UserRepository {
  findOrCreate(publicKey: string): Promise<User>;
  findByPublicKey(publicKey: string): Promise<User | null>;
  updateLastLogin(publicKey: string): Promise<User | null>;
}
