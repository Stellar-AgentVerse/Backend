import { Injectable } from '@nestjs/common';
import { ChallengeEntry, ChallengeStore } from './challenge-store.interface';

@Injectable()
export class InMemoryChallengeStore implements ChallengeStore {
  private readonly store = new Map<string, ChallengeEntry>();
  private sweepInterval?: ReturnType<typeof setInterval>;

  constructor() {
    this.startSweepInterval();
  }

  async set(publicKey: string, entry: ChallengeEntry): Promise<void> {
    this.store.set(publicKey, entry);
  }

  async get(publicKey: string): Promise<ChallengeEntry | null> {
    const entry = this.store.get(publicKey);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= new Date()) {
      this.store.delete(publicKey);
      return null;
    }
    return entry;
  }

  async delete(publicKey: string): Promise<void> {
    this.store.delete(publicKey);
  }

  async sweep(): Promise<number> {
    const now = new Date();
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  clearSweepInterval(): void {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = undefined;
    }
  }

  private startSweepInterval(): void {
    // Sweep expired entries every 60 seconds
    this.sweepInterval = setInterval(() => {
      this.sweep().catch(() => {
        // Silently handle sweep errors
      });
    }, 60_000);
    // Allow the process to exit even if the interval is active
    if (this.sweepInterval && typeof this.sweepInterval === 'object' && 'unref' in this.sweepInterval) {
      this.sweepInterval.unref();
    }
  }
}
