import { InMemoryUserRepository } from './in-memory-user.repository';
import { UserStatus } from '../models/user.interface';

describe('InMemoryUserRepository', () => {
  let repository: InMemoryUserRepository;

  beforeEach(() => {
    repository = new InMemoryUserRepository();
  });

  describe('findOrCreate', () => {
    it('should create a new user when publicKey does not exist', () => {
      const user = repository.findOrCreate('GBSHARK...');

      expect(user.publicKey).toBe('GBSHARK...');
      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.displayName).toBe('');
      expect(user.avatar).toBe('');
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.lastLoginAt).toBeInstanceOf(Date);
    });

    it('should return existing user when publicKey already exists', () => {
      const firstCall = repository.findOrCreate('GBSHARK...');
      const secondCall = repository.findOrCreate('GBSHARK...');

      expect(secondCall).toBe(firstCall);
      expect(secondCall.publicKey).toBe('GBSHARK...');
    });
  });

  describe('findByPublicKey', () => {
    it('should return null when user does not exist', () => {
      const result = repository.findByPublicKey('UNKNOWN_KEY');
      expect(result).toBeNull();
    });

    it('should return the user when they exist', () => {
      repository.findOrCreate('GBSHARK...');
      const result = repository.findByPublicKey('GBSHARK...');

      expect(result).not.toBeNull();
      expect(result!.publicKey).toBe('GBSHARK...');
    });
  });

  describe('updateLastLogin', () => {
    it('should update lastLoginAt and return the updated user', async () => {
      repository.findOrCreate('GBSHARK...');
      const originalLastLogin = repository.findByPublicKey('GBSHARK...')!.lastLoginAt;

      // Wait a small amount to ensure time difference
      await new Promise((r) => setTimeout(r, 5));

      const updated = repository.updateLastLogin('GBSHARK...');

      expect(updated).not.toBeNull();
      expect(updated!.lastLoginAt.getTime()).toBeGreaterThan(originalLastLogin.getTime());
      expect(updated!.publicKey).toBe('GBSHARK...');
    });

    it('should return null when user does not exist', () => {
      const result = repository.updateLastLogin('UNKNOWN_KEY');
      expect(result).toBeNull();
    });
  });
});
