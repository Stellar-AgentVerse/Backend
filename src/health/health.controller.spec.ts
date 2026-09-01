import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import { HealthReport, HealthService } from './health.service';

function reportWith(overrides: Partial<HealthReport>): HealthReport {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: 1,
    db: 'connected',
    checks: [{ name: 'database', status: 'ok', required: true }],
    ...overrides,
  };
}

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: { check: jest.Mock };
  let res: Response;
  let statusSpy: jest.Mock;

  beforeEach(async () => {
    healthService = { check: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: healthService }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    statusSpy = jest.fn().mockReturnThis();
    res = { status: statusSpy } as unknown as Response;
  });

  it('should return 200 and the dependency report when everything is healthy', async () => {
    healthService.check.mockResolvedValue(reportWith({}));

    const result = await controller.check(res);

    expect(statusSpy).toHaveBeenCalledWith(HttpStatus.OK);
    expect(result.status).toBe('ok');
    expect(result.db).toBe('connected');
    expect(result.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'database' })]),
    );
  });

  it('should return 503 when a required dependency is down', async () => {
    healthService.check.mockResolvedValue(
      reportWith({
        status: 'error',
        db: 'error',
        checks: [
          {
            name: 'database',
            status: 'error',
            required: true,
            detail: 'DB down',
          },
        ],
      }),
    );

    const result = await controller.check(res);

    expect(statusSpy).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(result.status).toBe('error');
    expect(result.db).toBe('error');
  });

  it('should keep liveness at 200 regardless of dependencies', () => {
    const result = controller.live();

    expect(result.status).toBe('ok');
    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('uptime');
    expect(healthService.check).not.toHaveBeenCalled();
  });
});
