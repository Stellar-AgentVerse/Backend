import { Injectable, Optional } from '@nestjs/common';
import { DataSource, LessThanOrEqual, Repository } from 'typeorm';
import { AuthChallenge } from '../../database/entities/auth-challenge.entity';
import type { ChallengeEntry, ChallengeStore } from './challenge-store.interface';
import { InMemoryChallengeStore } from './in-memory-challenge.store';

/**
 * Durable challenge storage for multi-instance deployments.
 *
 * The in-memory fallback exists only for isolated AuthModule unit tests where
 * no DataSource is registered. AppModule always supplies the initialized
 * PostgreSQL DataSource, so production challenges are shared and single-use.
 */
@Injectable()
export class DatabaseChallengeStore implements ChallengeStore {
  private readonly memoryFallback = new InMemoryChallengeStore();
  private readonly repository?: Repository<AuthChallenge>;

  constructor(@Optional() dataSource?: DataSource) {
    if (dataSource) {
      this.repository = dataSource.getRepository(AuthChallenge);
    }
  }

  async set(publicKey: string, entry: ChallengeEntry): Promise<void> {
    if (!this.repository) return this.memoryFallback.set(publicKey, entry);
    await this.repository.save({ ...entry });
  }

  async get(publicKey: string): Promise<ChallengeEntry | null> {
    if (!this.repository) return this.memoryFallback.get(publicKey);
    const entity = await this.repository.findOne({ where: { publicKey } });
    if (!entity) return null;
    if (entity.expiresAt <= new Date()) {
      await this.repository.delete({ publicKey });
      return null;
    }
    return this.toEntry(entity);
  }

  async consume(publicKey: string): Promise<ChallengeEntry | null> {
    if (!this.repository) return this.memoryFallback.consume(publicKey);

    return this.repository.manager.transaction(async (manager) => {
      const entity = await manager.findOne(AuthChallenge, {
        where: { publicKey },
        lock: { mode: 'pessimistic_write' },
      });
      if (!entity) return null;

      await manager.delete(AuthChallenge, { publicKey });
      if (entity.expiresAt <= new Date()) return null;
      return this.toEntry(entity);
    });
  }

  async delete(publicKey: string): Promise<void> {
    if (!this.repository) return this.memoryFallback.delete(publicKey);
    await this.repository.delete({ publicKey });
  }

  async sweep(): Promise<number> {
    if (!this.repository) return this.memoryFallback.sweep();
    const result = await this.repository.delete({ expiresAt: LessThanOrEqual(new Date()) });
    return result.affected ?? 0;
  }

  private toEntry(entity: AuthChallenge): ChallengeEntry {
    return {
      publicKey: entity.publicKey,
      challenge: entity.challenge,
      expiresAt: entity.expiresAt,
    };
  }
}
