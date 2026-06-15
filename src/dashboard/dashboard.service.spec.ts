import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardService } from './dashboard.service';
import { Asset, AssetMetric, ActivityLog, AssetType, AssetStatus } from '../database/entities';

describe('DashboardService', () => {
  let service: DashboardService;
  let assetRepo: jest.Mocked<Repository<Asset>>;
  let metricRepo: jest.Mocked<Repository<AssetMetric>>;
  let logRepo: jest.Mocked<Repository<ActivityLog>>;

  const createRepoMock = <T,>() =>
    ({
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    }) as unknown as jest.Mocked<Repository<T>>;

  beforeEach(async () => {
    assetRepo = createRepoMock<Asset>();
    metricRepo = createRepoMock<AssetMetric>();
    logRepo = createRepoMock<ActivityLog>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Asset), useValue: assetRepo },
        { provide: getRepositoryToken(AssetMetric), useValue: metricRepo },
        { provide: getRepositoryToken(ActivityLog), useValue: logRepo },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('aggregates metrics across published and pending assets', async () => {
    assetRepo.find.mockResolvedValue([
      { id: 'asset-1' } as Asset,
      { id: 'asset-2' } as Asset,
    ]);
    assetRepo.count.mockResolvedValue(3);

    const revenueQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '123.45' }),
    };
    const executionsQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '88' }),
    };
    metricRepo.createQueryBuilder
      .mockReturnValueOnce(revenueQb as never)
      .mockReturnValueOnce(executionsQb as never);

    await expect(service.getMetrics('GBCREATOR')).resolves.toEqual({
      totalRevenue: 123.45,
      assetsPublished: 2,
      totalExecutions: 88,
      reliability: '99.9',
      revenueTrend: '+12.4',
      pendingVerification: 3,
    });

    expect(assetRepo.find).toHaveBeenCalledWith({
      where: { creatorPublicKey: 'GBCREATOR', status: 'PUBLISHED' },
    });
    expect(assetRepo.count).toHaveBeenCalledWith({
      where: { creatorPublicKey: 'GBCREATOR', status: 'PENDING' },
    });
    expect(metricRepo.createQueryBuilder).toHaveBeenNthCalledWith(1, 'm');
    expect(metricRepo.createQueryBuilder).toHaveBeenNthCalledWith(2, 'm');
  });

  it('sorts top assets by revenue and formats totals', async () => {
    assetRepo.find.mockResolvedValue([
      {
        id: 'asset-1',
        name: 'Alpha',
        type: AssetType.AGENT,
        creatorPublicKey: 'GBCREATOR1',
        price: '10',
      } as Asset,
      {
        id: 'asset-2',
        name: 'Beta',
        type: AssetType.MODEL,
        creatorPublicKey: 'GBCREATOR2',
        price: '0',
      } as Asset,
      {
        id: 'asset-3',
        name: 'Gamma',
        type: AssetType.TOOL,
        creatorPublicKey: 'GBCREATOR3',
        price: '5',
      } as Asset,
    ]);
    metricRepo.findOne
      .mockResolvedValueOnce({ revenue: '12.5', executions: '8' } as AssetMetric)
      .mockResolvedValueOnce({ revenue: '50', executions: '1000' } as AssetMetric)
      .mockResolvedValueOnce({ revenue: '7', executions: '2' } as AssetMetric);

    await expect(service.getTopAssets(undefined, 2)).resolves.toEqual([
      {
        name: 'Beta',
        category: AssetType.MODEL,
        revenue: '50 XLM',
        calls: '1,000 calls',
        gradient: 'from-secondary/20 to-transparent',
        assetId: 'asset-2',
      },
      {
        name: 'Alpha',
        category: AssetType.AGENT,
        revenue: '12.5 XLM',
        calls: '8 calls',
        gradient: 'from-primary/10 to-transparent',
        assetId: 'asset-1',
      },
    ]);

    expect(assetRepo.find).toHaveBeenCalledWith({
      where: { status: 'PUBLISHED' },
      take: 4,
    });
  });

  it('formats activity logs and timeAgo values', async () => {
    const now = new Date('2024-01-03T12:00:00.000Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    logRepo.find.mockResolvedValue([
      {
        event: 'Published',
        asset: 'Alpha',
        status: 'Active',
        revenue: '10 XLM',
        createdAt: new Date('2024-01-03T11:59:30.000Z'),
      } as ActivityLog,
      {
        event: 'Updated',
        asset: 'Beta',
        status: 'Paused',
        revenue: '0 XLM',
        createdAt: new Date('2024-01-03T10:00:00.000Z'),
      } as ActivityLog,
    ]);

    await expect(service.getActivityLogs('GBCREATOR', 2)).resolves.toEqual([
      {
        event: 'Published',
        asset: 'Alpha',
        status: 'Active',
        statusClass: 'text-secondary bg-secondary/10',
        revenue: '10 XLM',
        time: 'just now',
      },
      {
        event: 'Updated',
        asset: 'Beta',
        status: 'Paused',
        statusClass: 'text-on-surface-variant bg-surface-variant',
        revenue: '0 XLM',
        time: '2 hrs ago',
      },
    ]);

    expect(logRepo.find).toHaveBeenCalledWith({
      where: { userPublicKey: 'GBCREATOR' },
      order: { createdAt: 'DESC' },
      take: 2,
    });
  });
});
