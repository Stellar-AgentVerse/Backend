import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { PurchasesController } from '../src/marketplace/purchases.controller';
import { PurchasesService } from '../src/marketplace/purchases.service';

const MOCK_USER = {
  publicKey: 'GBUYERMOCKE2ETEST',
  iat: Math.floor(Date.now() / 1000),
};

describe('Marketplace Purchases API (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let purchasesService: jest.Mocked<PurchasesService>;
  let validToken: string;

  beforeAll(async () => {
    const serviceMock = {
      createIntent: jest.fn(),
      confirm: jest.fn(),
      getAccess: jest.fn(),
    } as unknown as jest.Mocked<PurchasesService>;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              jwt: { secret: 'test-secret-for-e2e', expiresIn: '1h' },
              soroban: { marketplaceContractId: '' },
            }),
          ],
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: 'test-secret-for-e2e',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [PurchasesController],
      providers: [
        JwtStrategy,
        { provide: PurchasesService, useValue: serviceMock },
      ],
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

    jwtService = app.get(JwtService);
    validToken = jwtService.sign(MOCK_USER);
    purchasesService = app.get(PurchasesService) as jest.Mocked<PurchasesService>;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/marketplace/purchases', () => {
    const validBody = { assetId: '550e8400-e29b-41d4-a716-446655440000' };

    it('returns 201 with a purchase intent for authenticated user', async () => {
      purchasesService.createIntent.mockResolvedValue({
        purchaseId: 'purchase-1',
        unsignedXdr: 'AAAAAgAAAAB...mock-xdr...',
        expiresAt: new Date('2026-07-21T13:00:00Z'),
        contractId: 'MOCK_CONTRACT',
        networkPassphrase: 'Test SDF Network ; September 2015',
        assetId: validBody.assetId,
        amount: 25,
        idempotencyKey: 'idem-e2e-001',
      } as any);

      const res = await request(app.getHttpServer())
        .post('/api/marketplace/purchases')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validBody)
        .expect(201);

      expect(res.body).toMatchObject({
        purchaseId: 'purchase-1',
        unsignedXdr: expect.any(String),
        assetId: validBody.assetId,
      });
      expect(purchasesService.createIntent).toHaveBeenCalledWith(
        validBody.assetId,
        MOCK_USER.publicKey,
        undefined,
      );
    });

    it('returns 201 with idempotencyKey when provided', async () => {
      purchasesService.createIntent.mockResolvedValue({
        purchaseId: 'purchase-2',
        unsignedXdr: 'AAAA...',
        expiresAt: new Date(),
        contractId: 'MOCK',
        networkPassphrase: 'Test',
        assetId: validBody.assetId,
        amount: 10,
        idempotencyKey: 'my-idem-key',
      } as any);

      await request(app.getHttpServer())
        .post('/api/marketplace/purchases')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ assetId: validBody.assetId, idempotencyKey: 'my-idem-key' })
        .expect(201);

      expect(purchasesService.createIntent).toHaveBeenCalledWith(
        validBody.assetId,
        MOCK_USER.publicKey,
        'my-idem-key',
      );
    });

    it('returns 400 for missing assetId', async () => {
      await request(app.getHttpServer())
        .post('/api/marketplace/purchases')
        .set('Authorization', `Bearer ${validToken}`)
        .send({})
        .expect(400);
    });

    it('returns 400 for invalid UUID', async () => {
      await request(app.getHttpServer())
        .post('/api/marketplace/purchases')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ assetId: 'not-a-uuid' })
        .expect(400);
    });

    it('propagates NotFound error', async () => {
      purchasesService.createIntent.mockRejectedValue(
        new (require('@nestjs/common').NotFoundException)('Asset not found'),
      );

      await request(app.getHttpServer())
        .post('/api/marketplace/purchases')
        .set('Authorization', `Bearer ${validToken}`)
        .send(validBody)
        .expect(404);
    });
  });

  describe('POST /api/marketplace/purchases/:id/confirm', () => {
    it('returns 200 with confirmed status', async () => {
      purchasesService.confirm.mockResolvedValue({
        purchaseId: 'purchase-1',
        status: 'VERIFIED',
      });

      await request(app.getHttpServer())
        .post('/api/marketplace/purchases/purchase-1/confirm')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ transactionHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2' })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toEqual({ purchaseId: 'purchase-1', status: 'VERIFIED' });
        });
    });

    it('returns 400 for missing transactionHash', async () => {
      await request(app.getHttpServer())
        .post('/api/marketplace/purchases/purchase-1/confirm')
        .set('Authorization', `Bearer ${validToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/marketplace/purchases/:id/access', () => {
    it('returns 200 with delivery reference for the owner', async () => {
      purchasesService.getAccess.mockResolvedValue({
        purchaseId: 'purchase-1',
        assetId: 'asset-1',
        deliveryReference: 'asset://asset-1/purchase/purchase-1',
        purchasedAt: new Date('2026-07-21T12:00:00Z'),
      });

      await request(app.getHttpServer())
        .get('/api/marketplace/purchases/purchase-1/access')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            purchaseId: 'purchase-1',
            deliveryReference: 'asset://asset-1/purchase/purchase-1',
          });
        });
    });
  });
});
