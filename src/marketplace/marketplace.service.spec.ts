import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { MarketplaceService } from './marketplace.service';
import { Asset, AssetMetric, AssetType, AssetStatus } from '../database/entities';

describe('MarketplaceService', () => {
  let service: MarketplaceService;
  let assetRepo: jest.Mocked<Repository<Asset>>;
  let metricRepo: jest.Mocked<Repository<AssetMetric>>;

  const createRepoMock = <T,>() =>
    ({
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    }) as unknown as jest.Mocked<Repository<T>>;

  beforeEach(async () => {
    assetRepo = createRepoMock<Asset>();
    metricRepo = createRepoMock<AssetMetric>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketplaceService,
        { provide: getRepositoryToken(Asset), useValue: assetRepo },
        { provide: getRepositoryToken(AssetMetric), useValue: metricRepo },
      ],
    }).compile();

    service = module.get(MarketplaceService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('searches published assets with type and text filters using Brackets', async () => {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(2),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'asset-1',
          name: 'Alpha',
          slug: 'alpha',
          type: AssetType.MODEL,
          creatorPublicKey: 'GBCREATOR1',
          price: '10',
          description: 'First asset',
          imageUrl: '',
        } as Asset,
      ]),
    };
    assetRepo.createQueryBuilder.mockReturnValue(qb as never);
    metricRepo.findOne.mockResolvedValue({ revenue: '12.5', rating: '4.2', executions: '7' } as AssetMetric);

    const result = await service.search('alpha', 'MODEL', 3, 7);

    expect(assetRepo.createQueryBuilder).toHaveBeenCalledWith('a');
    expect(qb.where).toHaveBeenCalledWith('a.status = :status', { status: 'PUBLISHED' });
    expect(qb.andWhere).toHaveBeenNthCalledWith(1, 'a.type = :type', { type: 'MODEL' });

    const brackets = qb.andWhere.mock.calls[1][0] as Brackets;
    expect(brackets).toBeInstanceOf(Brackets);
    const inner = { where: jest.fn().mockReturnThis(), orWhere: jest.fn().mockReturnThis() };
    brackets.whereFactory(inner as never);
    expect(inner.where).toHaveBeenCalledWith('a.name ILIKE :q', { q: '%alpha%' });
    expect(inner.orWhere).toHaveBeenCalledWith('a.description ILIKE :q2', { q2: '%alpha%' });

    expect(qb.orderBy).toHaveBeenCalledWith('a.createdAt', 'DESC');
    expect(qb.skip).toHaveBeenCalledWith(3);
    expect(qb.take).toHaveBeenCalledWith(7);
    expect(qb.getCount).toHaveBeenCalledTimes(1);
    expect(qb.getMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      total: 2,
      items: [
        expect.objectContaining({
          id: 'asset-1',
          title: 'Alpha',
          category: 'Featured Model',
          creator: 'GBCREATO...',
          rating: '4.2',
          price: '10 Credits',
          priceValue: 10,
          currency: 'Credits',
          tag: 'MODEL',
          gradient: 'from-secondary/10 to-transparent',
          executions: 7,
        }),
      ],
    });
  });

  it('returns featured items mapped from published assets', async () => {
    assetRepo.find.mockResolvedValue([
      {
        id: 'asset-2',
        name: 'Beta',
        slug: 'beta',
        type: AssetType.AGENT,
        creatorPublicKey: 'GBCREATOR2',
        price: '0',
        description: 'Featured asset',
        imageUrl: '/beta.png',
        status: AssetStatus.PUBLISHED,
      } as Asset,
    ]);
    metricRepo.findOne.mockResolvedValue({ revenue: '0', rating: '0', executions: '0' } as AssetMetric);

    await expect(service.getFeatured(1)).resolves.toEqual([
      expect.objectContaining({
        id: 'asset-2',
        category: 'Featured Agent',
        price: 'Free',
        tag: 'AGENT',
        gradient: 'from-accent/10 to-transparent',
      }),
    ]);
    expect(assetRepo.find).toHaveBeenCalledWith({
      where: { status: 'PUBLISHED' },
      order: { createdAt: 'DESC' },
      take: 1,
    });
  });

  it('sorts trending items by execution count', async () => {
    assetRepo.find.mockResolvedValue([
      {
        id: 'asset-1',
        name: 'Alpha',
        slug: 'alpha',
        type: AssetType.AGENT,
        creatorPublicKey: 'GBCREATOR1',
        price: '1',
        description: 'Alpha',
        imageUrl: '',
        status: AssetStatus.PUBLISHED,
      } as Asset,
      {
        id: 'asset-2',
        name: 'Beta',
        slug: 'beta',
        type: AssetType.MODEL,
        creatorPublicKey: 'GBCREATOR2',
        price: '2',
        description: 'Beta',
        imageUrl: '',
        status: AssetStatus.PUBLISHED,
      } as Asset,
      {
        id: 'asset-3',
        name: 'Gamma',
        slug: 'gamma',
        type: AssetType.TOOL,
        creatorPublicKey: 'GBCREATOR3',
        price: '3',
        description: 'Gamma',
        imageUrl: '',
        status: AssetStatus.PUBLISHED,
      } as Asset,
      {
        id: 'asset-4',
        name: 'Delta',
        slug: 'delta',
        type: AssetType.ORACLE,
        creatorPublicKey: 'GBCREATOR4',
        price: '4',
        description: 'Delta',
        imageUrl: '',
        status: AssetStatus.PUBLISHED,
      } as Asset,
    ]);
    metricRepo.findOne
      .mockResolvedValueOnce({ executions: '10', rating: '1', revenue: '1' } as AssetMetric)
      .mockResolvedValueOnce({ executions: '50', rating: '4', revenue: '2' } as AssetMetric)
      .mockResolvedValueOnce({ executions: '25', rating: '3', revenue: '3' } as AssetMetric)
      .mockResolvedValueOnce({ executions: '5', rating: '2', revenue: '4' } as AssetMetric);

    await expect(service.getTrending(2)).resolves.toEqual([
      expect.objectContaining({ id: 'asset-2', title: 'Beta' }),
      expect.objectContaining({ id: 'asset-3', title: 'Gamma' }),
    ]);

    expect(assetRepo.find).toHaveBeenCalledWith({
      where: { status: 'PUBLISHED' },
      order: { createdAt: 'DESC' },
      take: 4,
    });
  });

  it('returns marketplace categories', async () => {
    await expect(service.getCategories()).resolves.toEqual([
      { label: 'Agents', icon: 'smart_toy', type: AssetType.AGENT },
      { label: 'Prompts', icon: 'terminal', type: AssetType.PROMPT },
      { label: 'Datasets', icon: 'database', type: AssetType.DATASET },
      { label: 'Workflows', icon: 'account_tree', type: AssetType.TOOL },
      { label: 'Models', icon: 'memory', type: AssetType.MODEL },
      { label: 'Oracles', icon: 'radar', type: AssetType.ORACLE },
    ]);
  });
});
