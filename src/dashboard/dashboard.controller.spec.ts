import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: jest.Mocked<DashboardService>;

  beforeEach(async () => {
    const dashboardServiceMock = {
      getMetrics: jest.fn(),
      getTopAssets: jest.fn(),
      getActivityLogs: jest.fn(),
    } as unknown as jest.Mocked<DashboardService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: dashboardServiceMock }],
    }).compile();

    controller = module.get(DashboardController);
    dashboardService = module.get(DashboardService) as jest.Mocked<DashboardService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delegates metrics requests to DashboardService', async () => {
    const metrics = { totalRevenue: 10 };
    dashboardService.getMetrics.mockResolvedValue(metrics as never);

    await expect(controller.getMetrics('GBCREATOR')).resolves.toEqual(metrics);
    expect(dashboardService.getMetrics).toHaveBeenCalledWith('GBCREATOR');
  });

  it('uses the default top-assets limit when none is provided', async () => {
    const topAssets = [{ assetId: 'asset-1' }];
    dashboardService.getTopAssets.mockResolvedValue(topAssets as never);

    await expect(controller.getTopAssets()).resolves.toEqual(topAssets);
    expect(dashboardService.getTopAssets).toHaveBeenCalledWith(undefined, 5);
  });

  it('delegates activity log requests with the requested limit', async () => {
    const logs = [{ event: 'Published' }];
    dashboardService.getActivityLogs.mockResolvedValue(logs as never);

    await expect(controller.getActivityLogs('GBCREATOR', 12)).resolves.toEqual(logs);
    expect(dashboardService.getActivityLogs).toHaveBeenCalledWith('GBCREATOR', 12);
  });
});
