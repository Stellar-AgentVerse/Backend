import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { HealthModule } from '../src/health/health.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;
  const dataSourceMock = {
    query: jest.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
      providers: [{ provide: DataSource, useValue: dataSourceMock }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('/api/health (GET)', async () => {
    dataSourceMock.query.mockResolvedValue([{ 1: 1 }]);

    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('ok');
        expect(res.body.db).toBe('connected');
      });
  });
});
