import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { WalletController } from '../src/wallet/wallet.controller';
import { WalletService } from '../src/wallet/wallet.service';

describe('Wallet API (e2e)', () => {
  let app: INestApplication;

  const walletServiceMock = {
    getBalance: jest.fn().mockResolvedValue({ credits: 100, xlmBalance: 42 }),
    getPackages: jest.fn().mockResolvedValue([{ id: 1, name: 'Starter' }]),
    getTransactions: jest.fn().mockResolvedValue([{ id: 1, type: 'PURCHASE' }]),
    purchasePackage: jest.fn().mockResolvedValue({ success: true }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [{ provide: WalletService, useValue: walletServiceMock }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /api/wallet/balance returns balance payload', async () => {
    await request(app.getHttpServer())
      .get('/api/wallet/balance?user=GBTEST')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ credits: 100, xlmBalance: 42 });
      });
  });

  it('GET /api/wallet/packages returns packages', async () => {
    await request(app.getHttpServer())
      .get('/api/wallet/packages')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([{ id: 1, name: 'Starter' }]);
      });
  });

  it('POST /api/wallet/purchase delegates purchasePackage', async () => {
    await request(app.getHttpServer())
      .post('/api/wallet/purchase?user=GBTEST')
      .send({ packageId: 1 })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true });
      });
  });
});
