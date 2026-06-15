import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AssetsController } from '../src/assets/assets.controller';
import { AssetsService } from '../src/assets/assets.service';

describe('Assets API (e2e)', () => {
  let app: INestApplication;

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
      controllers: [AssetsController],
      providers: [{ provide: AssetsService, useValue: assetsServiceMock }],
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

  it('POST /api/assets delegates create', async () => {
    await request(app.getHttpServer())
      .post('/api/assets?creator=GBTEST')
      .send({ name: 'Asset', type: 'AGENT' })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({ id: 'asset-new' });
      });
  });
});
