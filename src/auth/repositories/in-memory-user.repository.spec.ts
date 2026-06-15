import { InMemoryUserRepository } from './in-memory-user.repository';
import { UserStatus } from '../models/user.interface';

describe('InMemoryUserRepository', () => {
  let repository: InMemoryUserRepository;

  beforeEach(() => {
    repository = new InMemoryUserRepository();
  });

  describe('findOrCreate', () => {
    it('should create a new user when publicKey does not exist', async () => {
      const user = await repository.findOrCreate('GBSHARK...');

      expect(user.publicKey).toBe('GBSHARK...');
      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.displayName).toBe('');
      expect(user.avatar).toBe('');
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.lastLoginAt).toBeInstanceOf(Date);
    });

    it('should return existing user when publicKey already exists', async () => {
      const firstCall = await repository.findOrCreate('GBSHARK...');
      const secondCall = await repository.findOrCreate('GBSHARK...');

      expect(secondCall).toBe(firstCall);
      expect(secondCall.publicKey).toBe('GBSHARK...');
    });
  });

  describe('findByPublicKey', () => {
    it('should return null when user does not exist', async () => {
      const result = await repository.findByPublicKey('UNKNOWN_KEY');
      expect(result).toBeNull();
    });

    it('should return the user when they exist', async () => {
      await repository.findOrCreate('GBSHARK...');
      const result = await repository.findByPublicKey('GBSHARK...');

      expect(result).not.toBeNull();
      expect(result!.publicKey).toBe('GBSHARK...');
    });
  });

  describe('updateLastLogin', () => {
    it('should update lastLoginAt and return the updated user', async () => {
      await repository.findOrCreate('GBSHARK...');
      const originalLastLogin = (await repository.findByPublicKey('GBSHARK...'))!.lastLoginAt;

      // Wait a small amount to ensure time difference
      await new Promise((r) => setTimeout(r, 5));

      const updated = await repository.updateLastLogin('GBSHARK...');

      expect(updated).not.toBeNull();
      expect(updated!.lastLoginAt.getTime()).toBeGreaterThan(originalLastLogin.getTime());
      expect(updated!.publicKey).toBe('GBSHARK...');
    });

    it('should return null when user does not exist', async () => {
      const result = await repository.updateLastLogin('UNKNOWN_KEY');
      expect(result).toBeNull();
    });
  });
});
