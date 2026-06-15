import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { seedDatabase } from './seed';
import {
  Asset,
  AssetCapability,
  AssetMetric,
  ActivityLog,
  AssetSpec,
  AssetWorkflowStep,
  AssetType,
  CreditPackage,
  Tag,
  Wallet,
  WalletTransaction,
} from './entities';

describe('seedDatabase', () => {
  const originalRandom = Math.random;
  const originalNow = Date.now;

  const createRepo = () => ({
    count: jest.fn(),
    save: jest.fn(),
  });

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    jest.spyOn(Date, 'now').mockReturnValue(1700000000000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Math.random = originalRandom;
    Date.now = originalNow;
  });

  it('skips seeding when credit packages already exist', async () => {
    const pkgRepo = createRepo();
    pkgRepo.count.mockResolvedValue(1);
    const dataSource = {
      getRepository: jest.fn().mockReturnValue(pkgRepo),
    } as unknown as DataSource;

    await expect(seedDatabase(dataSource)).resolves.toBeUndefined();

    expect(pkgRepo.count).toHaveBeenCalledTimes(1);
    expect(pkgRepo.save).not.toHaveBeenCalled();
    expect(dataSource.getRepository).toHaveBeenCalledTimes(1);
  });

  it('seeds packages, assets, metrics, logs, wallet, and transactions when empty', async () => {
    const pkgRepo = createRepo();
    const tagRepo = createRepo();
    const assetRepo = createRepo();
    const metricRepo = createRepo();
    const capabilityRepo = createRepo();
    const workflowRepo = createRepo();
    const specRepo = createRepo();
    const logRepo = createRepo();
    const walletRepo = createRepo();
    const txRepo = createRepo();

    pkgRepo.count.mockResolvedValue(0);
    tagRepo.save.mockResolvedValue([]);
    pkgRepo.save.mockResolvedValue([]);
    assetRepo.save.mockImplementation(async (items: Asset[]) =>
      items.map((item, index) => ({ ...item, id: `asset-${index + 1}` } as Asset)),
    );
    metricRepo.save.mockResolvedValue([]);
    capabilityRepo.save.mockResolvedValue([]);
    workflowRepo.save.mockResolvedValue([]);
    specRepo.save.mockResolvedValue([]);
    logRepo.save.mockResolvedValue([]);
    walletRepo.save.mockResolvedValue({ id: 'wallet-1', userPublicKey: 'creator' } as Wallet);
    txRepo.save.mockResolvedValue([]);

    const repositories = [
      pkgRepo,
      tagRepo,
      assetRepo,
      metricRepo,
      capabilityRepo,
      workflowRepo,
      specRepo,
      logRepo,
      walletRepo,
      txRepo,
    ];

    const dataSource = {
      getRepository: jest.fn().mockImplementation((entity: unknown) => {
        if (entity === CreditPackage) return pkgRepo;
        if (entity === Tag) return tagRepo;
        if (entity === Asset) return assetRepo;
        if (entity === AssetMetric) return metricRepo;
        if (entity === AssetCapability) return capabilityRepo;
        if (entity === AssetWorkflowStep) return workflowRepo;
        if (entity === AssetSpec) return specRepo;
        if (entity === ActivityLog) return logRepo;
        if (entity === Wallet) return walletRepo;
        if (entity === WalletTransaction) return txRepo;
        return repositories[0];
      }),
    } as unknown as DataSource;

    await expect(seedDatabase(dataSource)).resolves.toBeUndefined();

    expect(pkgRepo.count).toHaveBeenCalledTimes(1);
    expect(tagRepo.save).toHaveBeenCalledWith([
      { name: 'beta', slug: 'beta' },
      { name: 'stable', slug: 'stable' },
      { name: 'experimental', slug: 'experimental' },
      { name: 'deprecated', slug: 'deprecated' },
      { name: 'featured', slug: 'featured' },
    ]);
    expect(pkgRepo.save).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ name: 'Starter', slug: 'starter', credits: 500, price: 50 }),
      expect.objectContaining({ name: 'Pro', slug: 'pro', credits: 2500, price: 200, popular: true }),
      expect.objectContaining({ name: 'Enterprise', slug: 'enterprise', credits: 10000, price: 800 }),
    ]));
    expect(assetRepo.save).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ slug: 'aura-7-research-intel', type: AssetType.AGENT }),
    ]));
    expect(metricRepo.save).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ assetId: 'asset-1', executions: 3000, revenue: 26000, activeUsers: 500, rating: 4.25, reliability: 97.5 }),
    ]));
    expect(capabilityRepo.save).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ assetId: 'asset-11', title: 'Deep Research' }),
      expect.objectContaining({ assetId: 'asset-11', title: 'Semantic Synthesis' }),
    ]));
    expect(workflowRepo.save).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ assetId: 'asset-11', stepOrder: 1 }),
      expect.objectContaining({ assetId: 'asset-11', stepOrder: 3 }),
    ]));
    expect(specRepo.save).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ assetId: 'asset-11', parameter: 'Model Architecture' }),
      expect.objectContaining({ assetId: 'asset-11', parameter: 'Output Formats' }),
    ]));
    expect(logRepo.save).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ event: 'Execution Success', asset: 'CYBERORACLE-V2' }),
      expect.objectContaining({ event: 'Model Update', asset: 'AURA-7-RESEARCH-INTEL' }),
    ]));
    expect(walletRepo.save).toHaveBeenCalledWith(expect.objectContaining({ userPublicKey: expect.any(String), credits: 450 }));
    expect(txRepo.save).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ description: 'Marketplace: Data Aggregator V2', amount: -120 }),
      expect.objectContaining({ description: 'Resource Refill: Starter Pack', amount: 500 }),
    ]));
  });
});
