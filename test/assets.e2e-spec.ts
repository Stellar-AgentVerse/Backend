import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { AssetsController } from '../src/assets/assets.controller';
import { AssetsService } from '../src/assets/assets.service';

const MOCK_USER = { publicKey: 'GAUTHUSER123', iat: Math.floor(Date.now() / 1000) };

describe('Assets API (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let validToken: string;

  const assetsServiceMock = {
    getAssetTypes: jest.fn().mockResolvedValue(['AGENT', 'DATASET']),
    getTags: jest.fn().mockResolvedValue([{ name: 'featured' }]),
    findPublished: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findByCreator: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue({ id: 'asset-1' }),
    create: jest.fn().mockResolvedValue({ id: 'asset-new' }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              jwt: { secret: 'test-secret-for-e2e', expiresIn: '1h' },
            }),
          ],
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: 'test-secret-for-e2e',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [AssetsController],
      providers: [
        JwtStrategy,
        { provide: AssetsService, useValue: assetsServiceMock },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    jwtService = app.get(JwtService);
    validToken = jwtService.sign(MOCK_USER);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/assets returns list payload', async () => {
    await request(app.getHttpServer())
      .get('/api/assets')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ items: [], total: 0 });
      });
  });

  it('GET /api/assets/types returns asset types', async () => {
    await request(app.getHttpServer())
      .get('/api/assets/types')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(['AGENT', 'DATASET']);
      });
  });

  it('POST /api/assets delegates create with JWT auth', async () => {
    await request(app.getHttpServer())
      .post('/api/assets')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ name: 'Asset', type: 'AGENT' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({ id: 'asset-new' });
      });
  });

  it('GET /api/assets/5 returns a single asset', async () => {
    await request(app.getHttpServer())
      .get('/api/assets/5')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ id: 'asset-1' });
      });
  });
});
