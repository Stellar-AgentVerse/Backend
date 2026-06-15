import { InMemoryChallengeStore } from './in-memory-challenge.store';
import { ChallengeEntry } from './challenge-store.interface';

describe('InMemoryChallengeStore', () => {
  let store: InMemoryChallengeStore;

  beforeEach(() => {
    store = new InMemoryChallengeStore();
  });

  afterEach(() => {
    store.clearSweepInterval();
  });

  describe('set', () => {
    it('should store a challenge entry for a given publicKey', async () => {
      const entry: ChallengeEntry = {
        challenge: '550e8400-e29b-41d4-a716-446655440000',
        publicKey: 'GBSHARK...',
        expiresAt: new Date(Date.now() + 300_000),
      };

      await store.set('GBSHARK...', entry);
      const retrieved = await store.get('GBSHARK...');

      expect(retrieved).toEqual(entry);
    });

    it('should overwrite existing challenge for the same publicKey', async () => {
      const entry1: ChallengeEntry = {
        challenge: 'first-uuid',
        publicKey: 'GBSHARK...',
        expiresAt: new Date(Date.now() + 300_000),
      };
      const entry2: ChallengeEntry = {
        challenge: 'second-uuid',
        publicKey: 'GBSHARK...',
        expiresAt: new Date(Date.now() + 300_000),
      };

      await store.set('GBSHARK...', entry1);
      await store.set('GBSHARK...', entry2);
      const retrieved = await store.get('GBSHARK...');

      expect(retrieved).toEqual(entry2);
    });
  });

  describe('get', () => {
    it('should return null for an unknown publicKey', async () => {
      const result = await store.get('UNKNOWN_KEY');
      expect(result).toBeNull();
    });

    it('should return null for an expired challenge entry', async () => {
      const expiredEntry: ChallengeEntry = {
        challenge: 'expired-uuid',
        publicKey: 'GBSHARK...',
        expiresAt: new Date(Date.now() - 10_000), // already expired
      };

      await store.set('GBSHARK...', expiredEntry);
      const result = await store.get('GBSHARK...');

      expect(result).toBeNull();
    });

    it('should return the entry for a non-expired challenge', async () => {
      const entry: ChallengeEntry = {
        challenge: 'valid-uuid',
        publicKey: 'GBSHARK...',
        expiresAt: new Date(Date.now() + 300_000),
      };

      await store.set('GBSHARK...', entry);
      const result = await store.get('GBSHARK...');

      expect(result).toEqual(entry);
    });
  });

  describe('delete', () => {
    it('should remove a stored challenge entry', async () => {
      const entry: ChallengeEntry = {
        challenge: 'delete-me',
        publicKey: 'GBSHARK...',
        expiresAt: new Date(Date.now() + 300_000),
      };

      await store.set('GBSHARK...', entry);
      await store.delete('GBSHARK...');
      const result = await store.get('GBSHARK...');

      expect(result).toBeNull();
    });

    it('should not throw when deleting a non-existent key', async () => {
      await expect(store.delete('NONEXISTENT')).resolves.toBeUndefined();
    });
  });

  describe('sweep', () => {
    it('should remove expired entries and return count of removed', async () => {
      const fresh: ChallengeEntry = {
        challenge: 'fresh',
        publicKey: 'KEY1',
        expiresAt: new Date(Date.now() + 300_000),
      };
      const stale: ChallengeEntry = {
        challenge: 'stale',
        publicKey: 'KEY2',
        expiresAt: new Date(Date.now() - 10_000),
      };
      const alsoStale: ChallengeEntry = {
        challenge: 'also-stale',
        publicKey: 'KEY3',
        expiresAt: new Date(Date.now() - 5_000),
      };

      await store.set('KEY1', fresh);
      await store.set('KEY2', stale);
      await store.set('KEY3', alsoStale);

      const removed = await store.sweep();

      expect(removed).toBe(2);
      // Fresh entry should still exist
      await expect(store.get('KEY1')).resolves.toEqual(fresh);
      // Stale entries should be gone
      await expect(store.get('KEY2')).resolves.toBeNull();
      await expect(store.get('KEY3')).resolves.toBeNull();
    });

    it('should return 0 when there are no expired entries', async () => {
      const entry: ChallengeEntry = {
        challenge: 'fresh',
        publicKey: 'KEY1',
        expiresAt: new Date(Date.now() + 300_000),
      };

      await store.set('KEY1', entry);
      const removed = await store.sweep();

      expect(removed).toBe(0);
    });
  });
});
