import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth.module';
import { JwtService } from '@nestjs/jwt';
import { CHALLENGE_STORE, USER_REPOSITORY } from './common/auth-tokens';
import type { ChallengeStore } from './stores/challenge-store.interface';
import type { UserRepository } from './repositories/user-repository.interface';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// Mock @stellar/stellar-sdk at module level
jest.mock('@stellar/stellar-sdk', () => ({
  Keypair: {
    fromPublicKey: jest.fn(),
  },
}));

import { Keypair } from '@stellar/stellar-sdk';

// Test controller with a protected route
@Controller('test')
class TestProtectedController {
  @Get('protected')
  @UseGuards(JwtAuthGuard)
  getProtected(): { status: string } {
    return { status: 'ok' };
  }
}

describe('AuthController (integration)', () => {
  let app: INestApplication;
  let challengeStore: ChallengeStore;
  let userRepository: UserRepository;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ jwt: { secret: 'test-secret', expiresIn: '1h' } })],
        }),
        AuthModule,
      ],
      controllers: [TestProtectedController],
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

    challengeStore = moduleFixture.get<ChallengeStore>(CHALLENGE_STORE);
    userRepository = moduleFixture.get<UserRepository>(USER_REPOSITORY);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/challenge', () => {
    it('should return 400 for missing publicKey', () => {
      return request(app.getHttpServer())
        .post('/api/auth/challenge')
        .send({})
        .expect(400);
    });

    it('should return 200 with a challenge string for valid publicKey', () => {
      return request(app.getHttpServer())
        .post('/api/auth/challenge')
        .send({ publicKey: 'GBSHARK...' })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('challenge');
          expect(typeof res.body.challenge).toBe('string');
          expect(res.body.challenge.length).toBeGreaterThan(0);
        });
    });

    it('should return the same challenge when called twice within TTL', async () => {
      const res1 = await request(app.getHttpServer())
        .post('/api/auth/challenge')
        .send({ publicKey: 'GBSAME...' })
        .expect(200);

      const res2 = await request(app.getHttpServer())
        .post('/api/auth/challenge')
        .send({ publicKey: 'GBSAME...' })
        .expect(200);

      expect(res2.body.challenge).toBe(res1.body.challenge);
    });
  });

  describe('POST /api/auth/wallet', () => {
    const publicKey = 'GBVERIFY...';
    const validSignature = 'deadbeefcafe';
    const invalidSignature = 'badbadbad';

    it('should return 401 when no challenge was requested', () => {
      return request(app.getHttpServer())
        .post('/api/auth/wallet')
        .send({ publicKey, signature: validSignature })
        .expect(401);
    });

    it('should return 200 with token for valid signature', async () => {
      // Get a challenge first
      await request(app.getHttpServer())
        .post('/api/auth/challenge')
        .send({ publicKey })
        .expect(200);

      // Mock Keypair.verify() to return true
      const mockKeypair = {
        verify: jest.fn().mockReturnValue(true),
      };
      (Keypair.fromPublicKey as jest.Mock).mockReturnValue(mockKeypair);

      const res = await request(app.getHttpServer())
        .post('/api/auth/wallet')
        .send({ publicKey, signature: validSignature })
        .expect(200);

      expect(res.body).toHaveProperty('token');
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.length).toBeGreaterThan(0);
    });

    it('should return 401 for invalid signature', async () => {
      const pk = 'GBINVALID...';

      // Get a challenge first
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
        .send({ publicKey: pk, signature: invalidSignature })
        .expect(401);
    });
  });

  describe('JWT validation (REQ-03)', () => {
    it('should allow access to protected route with valid token', async () => {
      const token = jwtService.sign({ publicKey: 'GBPROTECT...' });

      await request(app.getHttpServer())
        .get('/api/test/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({ status: 'ok' });
        });
    });

    it('should return 401 when no token is provided', () => {
      return request(app.getHttpServer())
        .get('/api/test/protected')
        .expect(401);
    });

    it('should return 401 with malformed token', () => {
      return request(app.getHttpServer())
        .get('/api/test/protected')
        .set('Authorization', 'Bearer invalid-token-here')
        .expect(401);
    });
  });
});
