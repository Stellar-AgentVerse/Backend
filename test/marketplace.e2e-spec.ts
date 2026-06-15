import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { MarketplaceController } from '../src/marketplace/marketplace.controller';
import { MarketplaceService } from '../src/marketplace/marketplace.service';

describe('Marketplace API (e2e)', () => {
  let app: INestApplication;

  const marketplaceServiceMock = {
    search: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    getFeatured: jest.fn().mockResolvedValue([{ id: 'feat-1' }]),
    getTrending: jest.fn().mockResolvedValue([{ id: 'trend-1' }]),
    getCategories: jest.fn().mockResolvedValue(['AGENT', 'DATASET']),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MarketplaceController],
      providers: [{ provide: MarketplaceService, useValue: marketplaceServiceMock }],
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

  it('GET /api/marketplace/assets returns search payload', async () => {
    await request(app.getHttpServer())
      .get('/api/marketplace/assets?search=agent')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ items: [], total: 0 });
      });
  });

  it('GET /api/marketplace/featured returns featured assets', async () => {
    await request(app.getHttpServer())
      .get('/api/marketplace/featured')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([{ id: 'feat-1' }]);
      });
  });

  it('GET /api/marketplace/categories returns categories', async () => {
    await request(app.getHttpServer())
      .get('/api/marketplace/categories')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(['AGENT', 'DATASET']);
      });
  });
});
