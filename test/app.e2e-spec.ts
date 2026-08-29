import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { HealthController } from '../src/health/health.controller';
import { HealthService } from '../src/health/health.service';
import { sorobanConfig } from '../src/tokens/config/soroban.config';

interface HealthBody {
  status: string;
  db?: string;
  checks?: { name: string; status: string }[];
}

function bodyOf(response: { body: unknown }): HealthBody {
  return response.body as HealthBody;
}

describe('HealthController (e2e)', () => {
  let app: INestApplication<App>;
  const dataSourceMock = {
    query: jest.fn(),
  };
  const sorobanMock = {
    rpcUrl: 'https://soroban-testnet.stellar.org',
    contracts: { purchaseContractId: '' },
  };

  const originalFetch = global.fetch;

  beforeEach(async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: DataSource, useValue: dataSourceMock },
        { provide: sorobanConfig.KEY, useValue: sorobanMock },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('/api/health (GET) reports the applied schema when dependencies are healthy', async () => {
    dataSourceMock.query.mockImplementation((sql: string) =>
      sql.includes('migrations')
        ? Promise.resolve([
            { name: 'AlignMigratedSchemaWithEntities1700000004000' },
          ])
        : Promise.resolve([{ '?column?': 1 }]),
    );

    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        const report = bodyOf(res);
        expect(report.status).toBe('ok');
        expect(report.db).toBe('connected');
        expect(report.checks).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: 'schema', status: 'ok' }),
          ]),
        );
      });
  });

  it('/api/health (GET) returns 503 when the database is unreachable', async () => {
    dataSourceMock.query.mockRejectedValue(new Error('connection refused'));

    await request(app.getHttpServer())
      .get('/api/health')
      .expect(503)
      .expect((res) => {
        const report = bodyOf(res);
        expect(report.status).toBe('error');
        expect(report.db).toBe('error');
      });
  });

  it('/api/health/live (GET) stays 200 when the database is unreachable', async () => {
    dataSourceMock.query.mockRejectedValue(new Error('connection refused'));

    await request(app.getHttpServer())
      .get('/api/health/live')
      .expect(200)
      .expect((res) => {
        expect(bodyOf(res).status).toBe('ok');
      });
  });
});
