import { Injectable } from '@nestjs/common';
import { User } from '../models/user.interface';
import { UserEntity } from '../models/user.entity';
import { UserRepository } from './user-repository.interface';

@Injectable()
export class InMemoryUserRepository implements UserRepository {
  private readonly store = new Map<string, User>();

  findOrCreate(publicKey: string): User {
    const existing = this.store.get(publicKey);
    if (existing) {
      return existing;
    }
    const user = new UserEntity(publicKey);
    this.store.set(publicKey, user);
    return user;
  }

  findByPublicKey(publicKey: string): User | null {
    return this.store.get(publicKey) ?? null;
  }

  updateLastLogin(publicKey: string): User | null {
    const user = this.store.get(publicKey);
    if (!user) {
      return null;
    }
    user.lastLoginAt = new Date();
    return user;
  }
}
