import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DashboardController } from '../src/dashboard/dashboard.controller';
import { DashboardService } from '../src/dashboard/dashboard.service';

describe('Dashboard API (e2e)', () => {
  let app: INestApplication;

  const dashboardServiceMock = {
    getMetrics: jest.fn().mockResolvedValue({ totalAssets: 1, totalRevenue: 10 }),
    getTopAssets: jest.fn().mockResolvedValue([{ id: 'top-1' }]),
    getActivityLogs: jest.fn().mockResolvedValue([{ id: 'log-1' }]),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: dashboardServiceMock }],
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

  it('GET /api/dashboard/metrics returns metrics payload', async () => {
    await request(app.getHttpServer())
      .get('/api/dashboard/metrics?creator=GBTEST')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ totalAssets: 1, totalRevenue: 10 });
      });
  });

  it('GET /api/dashboard/top-assets returns top assets', async () => {
    await request(app.getHttpServer())
      .get('/api/dashboard/top-assets')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([{ id: 'top-1' }]);
      });
  });

  it('GET /api/dashboard/activity-logs returns activity logs', async () => {
    await request(app.getHttpServer())
      .get('/api/dashboard/activity-logs')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([{ id: 'log-1' }]);
      });
  });
});
