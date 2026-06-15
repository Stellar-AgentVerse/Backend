import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Mock @stellar/stellar-sdk at module level — keep original exports
jest.mock('@stellar/stellar-sdk', () => {
  const original = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...original,
    Keypair: {
      ...original.Keypair,
      fromPublicKey: jest.fn(),
    },
  };
});

import { Keypair } from '@stellar/stellar-sdk';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Full auth flow', () => {
    const publicKey = 'GDE2P...E2ETEST';

    it('should get a challenge, verify wallet, and receive a JWT', async () => {
      // Step 1: Get challenge
      const challengeRes = await request(app.getHttpServer())
        .post('/api/auth/challenge')
        .send({ publicKey })
        .expect(200);

      expect(challengeRes.body).toHaveProperty('challenge');
      expect(typeof challengeRes.body.challenge).toBe('string');

      // Step 2: Mock Keypair.verify() to return true
      const mockKeypair = {
        verify: jest.fn().mockReturnValue(true),
      };
      (Keypair.fromPublicKey as jest.Mock).mockReturnValue(mockKeypair);

      // Step 3: Verify wallet
      const verifyRes = await request(app.getHttpServer())
        .post('/api/auth/wallet')
        .send({ publicKey, signature: 'deadbeef' })
        .expect(200);

      expect(verifyRes.body).toHaveProperty('token');
      expect(verifyRes.body).toHaveProperty('user');
      expect(verifyRes.body.user.publicKey).toBe(publicKey);
    });

    it('should reject a replayed signature (single-use challenge)', async () => {
      const pk = 'GDE2P...REPLAY';

      // Get a challenge
      await request(app.getHttpServer())
        .post('/api/auth/challenge')
        .send({ publicKey: pk })
        .expect(200);

      // Mock Keypair.verify() to return true
      const mockKeypair = {
        verify: jest.fn().mockReturnValue(true),
      };
      (Keypair.fromPublicKey as jest.Mock).mockReturnValue(mockKeypair);

      // First verify should succeed
      await request(app.getHttpServer())
        .post('/api/auth/wallet')
        .send({ publicKey: pk, signature: 'deadbeef' })
        .expect(200);

      // Second verify with same signature should fail (challenge consumed)
      await request(app.getHttpServer())
        .post('/api/auth/wallet')
        .send({ publicKey: pk, signature: 'deadbeef' })
        .expect(401);
    });

    it('should return 401 with invalid signature', async () => {
      const pk = 'GDE2P...INVALID';

      // Get a challenge
      await request(app.getHttpServer())
        .post('/api/auth/challenge')
        .send({ publicKey: pk })
        .expect(200);

      // Mock Keypair.verify() to return false
      const mockKeypair = {
        verify: jest.fn().mockReturnValue(false),
      };
      (Keypair.fromPublicKey as jest.Mock).mockReturnValue(mockKeypair);

      await request(app.getHttpServer())
        .post('/api/auth/wallet')
        .send({ publicKey: pk, signature: 'badsig' })
        .expect(401);
    });
  });
});
