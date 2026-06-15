import { Injectable } from '@nestjs/common';
import { User } from '../models/user.interface';
import { UserEntity } from '../models/user.entity';
import { UserRepository } from './user-repository.interface';

@Injectable()
export class InMemoryUserRepository implements UserRepository {
  private readonly store = new Map<string, User>();

  async findOrCreate(publicKey: string): Promise<User> {
    const existing = this.store.get(publicKey);
    if (existing) {
      return existing;
    }
    const user = new UserEntity(publicKey);
    this.store.set(publicKey, user);
    return user;
  }

  async findByPublicKey(publicKey: string): Promise<User | null> {
    return this.store.get(publicKey) ?? null;
  }

  async updateLastLogin(publicKey: string): Promise<User | null> {
    const user = this.store.get(publicKey);
    if (!user) {
      return null;
    }
    user.lastLoginAt = new Date();
    return user;
  }
}
