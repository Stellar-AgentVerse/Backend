import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { DataSource } from 'typeorm';

describe('HealthController', () => {
  let controller: HealthController;
  let mockDataSource: Partial<DataSource>;

  beforeEach(async () => {
    mockDataSource = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return ok with db connected when query succeeds', async () => {
    (mockDataSource.query as jest.Mock).mockResolvedValue([{ 1: 1 }]);
    const result = await controller.check();
    expect(result.status).toBe('ok');
    expect(result.db).toBe('connected');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('uptime');
  });

  it('should return ok with db error when query fails', async () => {
    (mockDataSource.query as jest.Mock).mockRejectedValue(new Error('DB down'));
    const result = await controller.check();
    expect(result.status).toBe('ok');
    expect(result.db).toBe('error');
  });

  it('should return ok with db error when datasource is not initialized', async () => {
    (mockDataSource.query as jest.Mock).mockRejectedValue(new Error('not initialized'));
    const result = await controller.check();
    expect(result.status).toBe('ok');
    expect(result.db).toBe('error');
  });
});
