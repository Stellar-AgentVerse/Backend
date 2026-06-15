import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AssetsService } from './assets.service';
import {
  Asset,
  AssetMetric,
  AssetCapability,
  AssetWorkflowStep,
  AssetSpec,
  Tag,
  AssetType,
  AssetStatus,
} from '../database/entities';

describe('AssetsService', () => {
  let service: AssetsService;
  let assetRepo: jest.Mocked<Repository<Asset>>;
  let metricRepo: jest.Mocked<Repository<AssetMetric>>;
  let capabilityRepo: jest.Mocked<Repository<AssetCapability>>;
  let workflowRepo: jest.Mocked<Repository<AssetWorkflowStep>>;
  let specRepo: jest.Mocked<Repository<AssetSpec>>;
  let tagRepo: jest.Mocked<Repository<Tag>>;

  const createRepoMock = <T,>() =>
    ({
      create: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      save: jest.fn(),
    }) as unknown as jest.Mocked<Repository<T>>;

  beforeEach(async () => {
    assetRepo = createRepoMock<Asset>();
    metricRepo = createRepoMock<AssetMetric>();
    capabilityRepo = createRepoMock<AssetCapability>();
    workflowRepo = createRepoMock<AssetWorkflowStep>();
    specRepo = createRepoMock<AssetSpec>();
    tagRepo = createRepoMock<Tag>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: getRepositoryToken(Asset), useValue: assetRepo },
        { provide: getRepositoryToken(AssetMetric), useValue: metricRepo },
        { provide: getRepositoryToken(AssetCapability), useValue: capabilityRepo },
        { provide: getRepositoryToken(AssetWorkflowStep), useValue: workflowRepo },
        { provide: getRepositoryToken(AssetSpec), useValue: specRepo },
        { provide: getRepositoryToken(Tag), useValue: tagRepo },
      ],
    }).compile();

    service = module.get(AssetsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns published assets with pagination and filtering', async () => {
    const published = [
      {
        id: 'asset-1',
        name: 'Alpha',
        slug: 'alpha',
        description: 'One',
        type: AssetType.AGENT,
        creatorPublicKey: 'GB1',
        price: '12.50',
        status: AssetStatus.PUBLISHED,
        imageUrl: '',
        tags: ['ai'],
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    ] as Asset[];

    assetRepo.findAndCount.mockResolvedValue([published, 1]);

    const result = await service.findPublished(5, 10);

    expect(assetRepo.findAndCount).toHaveBeenCalledWith({
      where: { status: 'PUBLISHED' },
      order: { createdAt: 'DESC' },
      skip: 5,
      take: 10,
    });
    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'asset-1',
        price: 12.5,
        status: AssetStatus.PUBLISHED,
      }),
    ]);
  });

  it('returns an asset by id with metrics, capabilities, workflow, and specs', async () => {
    assetRepo.findOne.mockResolvedValue({
      id: 'asset-1',
      name: 'Alpha',
      slug: 'alpha',
      description: 'One',
      type: AssetType.AGENT,
      creatorPublicKey: 'GB1',
      price: '12.50',
      status: AssetStatus.PUBLISHED,
      imageUrl: '',
      tags: ['ai'],
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    } as Asset);
    metricRepo.findOne.mockResolvedValue({
      executions: '3',
      revenue: '10.25',
      activeUsers: 4,
      rating: '4.5',
      reliability: '99.9',
    } as AssetMetric);
    capabilityRepo.find.mockResolvedValue([
      { icon: 'bolt', title: 'Fast', description: 'Quick', sortOrder: 1 },
    ] as AssetCapability[]);
    workflowRepo.find.mockResolvedValue([
      { stepOrder: 1, icon: 'play', label: 'Start', isActive: true, isFilled: true },
    ] as AssetWorkflowStep[]);
    specRepo.find.mockResolvedValue([
      { parameter: 'mode', value: 'auto', notes: 'Default', sortOrder: 1 },
    ] as AssetSpec[]);

    const result = await service.findById('asset-1');

    expect(assetRepo.findOne).toHaveBeenCalledWith({ where: { id: 'asset-1' } });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'asset-1',
        price: 12.5,
        metrics: {
          executions: 3,
          revenue: 10.25,
          activeUsers: 4,
          rating: 4.5,
          reliability: 99.9,
        },
        capabilities: [
          {
            icon: 'bolt',
            title: 'Fast',
            description: 'Quick',
            sortOrder: 1,
          },
        ],
        workflow: [
          {
            stepOrder: 1,
            icon: 'play',
            label: 'Start',
            isActive: true,
            isFilled: true,
          },
        ],
        specs: [
          {
            parameter: 'mode',
            value: 'auto',
            notes: 'Default',
            sortOrder: 1,
          },
        ],
      }),
    );
  });

  it('throws when an asset id is missing', async () => {
    assetRepo.findOne.mockResolvedValue(null);

    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(metricRepo.findOne).not.toHaveBeenCalled();
  });

  it('returns assets created by a public key', async () => {
    assetRepo.find.mockResolvedValue([
      {
        id: 'asset-2',
        name: 'Beta',
        slug: 'beta',
        description: 'Two',
        type: AssetType.MODEL,
        creatorPublicKey: 'GBCREATOR',
        price: '4.00',
        status: AssetStatus.DRAFT,
        imageUrl: '',
        tags: null,
        createdAt: new Date('2024-01-03T00:00:00.000Z'),
        updatedAt: new Date('2024-01-03T00:00:00.000Z'),
      } as Asset,
    ]);

    const result = await service.findByCreator('GBCREATOR');

    expect(assetRepo.find).toHaveBeenCalledWith({
      where: { creatorPublicKey: 'GBCREATOR' },
      order: { createdAt: 'DESC' },
    });
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'asset-2',
        price: 4,
      }),
    );
  });

  it('returns asset types and sorted tags', async () => {
    tagRepo.find.mockResolvedValue([
      { id: 'tag-1', name: 'AI' },
      { id: 'tag-2', name: 'XR' },
    ] as Tag[]);

    await expect(service.getAssetTypes()).resolves.toHaveLength(6);
    await expect(service.getTags()).resolves.toEqual([
      { id: 'tag-1', name: 'AI' },
      { id: 'tag-2', name: 'XR' },
    ]);
    expect(tagRepo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
  });

  it('creates an asset and retries slug collisions until unique', async () => {
    const dto = {
      name: 'My New Asset',
      type: AssetType.TOOL,
      description: undefined,
      price: undefined,
      tags: undefined,
    };
    const savedAsset = {
      id: 'asset-99',
      name: 'My New Asset',
      slug: 'my-new-asset-2',
      description: '',
      type: AssetType.TOOL,
      creatorPublicKey: 'GBCREATOR',
      price: 0,
      status: AssetStatus.DRAFT,
      imageUrl: '',
      tags: [],
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    } as Asset;

    assetRepo.findOne
      .mockResolvedValueOnce({ id: 'collision-1' } as Asset)
      .mockResolvedValueOnce({ id: 'collision-2' } as Asset)
      .mockResolvedValueOnce(null);
    assetRepo.create.mockReturnValue(savedAsset);
    assetRepo.save.mockResolvedValue(savedAsset);
    metricRepo.create.mockReturnValue({ assetId: 'asset-99' } as AssetMetric);
    metricRepo.save.mockResolvedValue({ assetId: 'asset-99' } as AssetMetric);

    const result = await service.create(dto as never, 'GBCREATOR');

    expect(assetRepo.findOne).toHaveBeenNthCalledWith(1, { where: { slug: 'my-new-asset' } });
    expect(assetRepo.findOne).toHaveBeenNthCalledWith(2, { where: { slug: 'my-new-asset-1' } });
    expect(assetRepo.findOne).toHaveBeenNthCalledWith(3, { where: { slug: 'my-new-asset-2' } });
    expect(assetRepo.create).toHaveBeenCalledWith({
      name: 'My New Asset',
      slug: 'my-new-asset-2',
      description: '',
      type: AssetType.TOOL,
      creatorPublicKey: 'GBCREATOR',
      price: 0,
      tags: [],
    });
    expect(metricRepo.save).toHaveBeenCalledWith({ assetId: 'asset-99' });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'asset-99',
        slug: 'my-new-asset-2',
      }),
    );
  });
});
