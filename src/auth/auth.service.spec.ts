import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import type { ChallengeStore } from './stores/challenge-store.interface';
import type { UserRepository } from './repositories/user-repository.interface';
import { UserStatus } from './models/user.interface';
import { CHALLENGE_STORE, USER_REPOSITORY } from './common/auth-tokens';
import { UnauthorizedException } from '@nestjs/common';

// Mock @stellar/stellar-sdk
jest.mock('@stellar/stellar-sdk', () => ({
  Keypair: {
    fromPublicKey: jest.fn(),
  },
}));

import { Keypair } from '@stellar/stellar-sdk';

describe('AuthService', () => {
  let service: AuthService;
  let challengeStore: jest.Mocked<ChallengeStore>;
  let userRepository: jest.Mocked<UserRepository>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const challengeStoreMock: jest.Mocked<ChallengeStore> = {
      set: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      sweep: jest.fn(),
    };

    const userRepoMock: jest.Mocked<UserRepository> = {
      findOrCreate: jest.fn(),
      findByPublicKey: jest.fn(),
      updateLastLogin: jest.fn(),
    };

    const jwtServiceMock: jest.Mocked<JwtService> = {
      sign: jest.fn(),
      signAsync: jest.fn(),
      verify: jest.fn(),
      verifyAsync: jest.fn(),
      decode: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: CHALLENGE_STORE, useValue: challengeStoreMock },
        { provide: USER_REPOSITORY, useValue: userRepoMock },
        { provide: JwtService, useValue: jwtServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    challengeStore = module.get<ChallengeStore>(CHALLENGE_STORE) as jest.Mocked<ChallengeStore>;
    userRepository = module.get<UserRepository>(USER_REPOSITORY) as jest.Mocked<UserRepository>;
    jwtService = module.get(JwtService) as jest.Mocked<JwtService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateChallenge', () => {
    it('should generate a UUID challenge and store it', async () => {
      challengeStore.get.mockResolvedValue(null);

      const result = await service.generateChallenge('GBSHARK...');

      expect(result).toHaveProperty('challenge');
      expect(typeof result.challenge).toBe('string');
      expect(result.challenge.length).toBeGreaterThan(0);
      expect(challengeStore.set).toHaveBeenCalledWith(
        'GBSHARK...',
        expect.objectContaining({
          publicKey: 'GBSHARK...',
          challenge: result.challenge,
          expiresAt: expect.any(Date),
        }),
      );
    });

    it('should return existing cached challenge within TTL', async () => {
      const existingEntry = {
        challenge: 'existing-challenge-uuid',
        publicKey: 'GBSHARK...',
        expiresAt: new Date(Date.now() + 300_000),
      };
      challengeStore.get.mockResolvedValue(existingEntry);

      const result = await service.generateChallenge('GBSHARK...');

      expect(result.challenge).toBe('existing-challenge-uuid');
      expect(challengeStore.set).not.toHaveBeenCalled();
    });

    it('should generate new challenge when cached challenge is expired', async () => {
      // Simulate that the store returns null for expired entries (real behavior)
      challengeStore.get.mockResolvedValue(null);

      const result = await service.generateChallenge('GBSHARK...');

      expect(typeof result.challenge).toBe('string');
      expect(result.challenge.length).toBeGreaterThan(0);
      expect(challengeStore.set).toHaveBeenCalled();
    });
  });

  describe('verifyWallet', () => {
    const publicKey = 'GBSHARK...';
    const signature = 'deadbeef';

    it('should throw UnauthorizedException when no challenge exists', async () => {
      challengeStore.get.mockResolvedValue(null);

      await expect(
        service.verifyWallet(publicKey, signature),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when signature is invalid', async () => {
      const entry = {
        challenge: 'test-challenge',
        publicKey,
        expiresAt: new Date(Date.now() + 300_000),
      };
      challengeStore.get.mockResolvedValue(entry);
      challengeStore.delete.mockResolvedValue();

      const mockKeypair = {
        verify: jest.fn().mockReturnValue(false),
      };
      (Keypair.fromPublicKey as jest.Mock).mockReturnValue(mockKeypair);

      await expect(
        service.verifyWallet(publicKey, signature),
      ).rejects.toThrow(UnauthorizedException);
      expect(challengeStore.delete).toHaveBeenCalledWith(publicKey);
    });

    it('should create user, upsert, sign JWT on valid signature', async () => {
      const entry = {
        challenge: 'test-challenge',
        publicKey,
        expiresAt: new Date(Date.now() + 300_000),
      };
      challengeStore.get.mockResolvedValue(entry);
      challengeStore.delete.mockResolvedValue();

      const mockKeypair = {
        verify: jest.fn().mockReturnValue(true),
      };
      (Keypair.fromPublicKey as jest.Mock).mockReturnValue(mockKeypair);

      const mockUser = {
        publicKey,
        status: UserStatus.ACTIVE,
        displayName: '',
        avatar: '',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };
      userRepository.findOrCreate.mockResolvedValue(mockUser);
      userRepository.updateLastLogin.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('signed-jwt-token');

      const result = await service.verifyWallet(publicKey, signature);

      expect(result.token).toBe('signed-jwt-token');
      expect(result.user).toEqual(mockUser);
      expect(userRepository.findOrCreate).toHaveBeenCalledWith(publicKey);
      expect(userRepository.updateLastLogin).toHaveBeenCalledWith(publicKey);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ publicKey, iat: expect.any(Number) }),
      );
    });

    it('should delete challenge after verification regardless of outcome', async () => {
      const entry = {
        challenge: 'test-challenge',
        publicKey,
        expiresAt: new Date(Date.now() + 300_000),
      };
      challengeStore.get.mockResolvedValue(entry);
      challengeStore.delete.mockResolvedValue();

      const mockKeypair = {
        verify: jest.fn().mockReturnValue(true),
      };
      (Keypair.fromPublicKey as jest.Mock).mockReturnValue(mockKeypair);

      userRepository.findOrCreate.mockResolvedValue({
        publicKey,
        status: UserStatus.ACTIVE,
        displayName: '',
        avatar: '',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });
      userRepository.updateLastLogin.mockResolvedValue({
        publicKey,
        status: UserStatus.ACTIVE,
        displayName: '',
        avatar: '',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });
      jwtService.sign.mockReturnValue('token');

      await service.verifyWallet(publicKey, signature);

      expect(challengeStore.delete).toHaveBeenCalledWith(publicKey);
    });
  });
});
