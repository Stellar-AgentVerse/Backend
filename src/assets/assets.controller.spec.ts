import { Test, TestingModule } from '@nestjs/testing';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import { AssetType } from '../database/entities';

describe('AssetsController', () => {
  let controller: AssetsController;
  let assetsService: jest.Mocked<AssetsService>;

  beforeEach(async () => {
    const assetsServiceMock = {
      getAssetTypes: jest.fn(),
      getTags: jest.fn(),
      findPublished: jest.fn(),
      findByCreator: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<AssetsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssetsController],
      providers: [{ provide: AssetsService, useValue: assetsServiceMock }],
    }).compile();

    controller = module.get<AssetsController>(AssetsController);
    assetsService = module.get(AssetsService) as jest.Mocked<AssetsService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delegates getTypes to AssetsService', async () => {
    const types = [{ id: 'agent', title: 'Agent' }];
    assetsService.getAssetTypes.mockResolvedValue(types as never);

    await expect(controller.getTypes()).resolves.toEqual(types);
    expect(assetsService.getAssetTypes).toHaveBeenCalledTimes(1);
  });

  it('delegates getTags to AssetsService', async () => {
    const tags = [{ id: 'tag-1', name: 'AI' }];
    assetsService.getTags.mockResolvedValue(tags as never);

    await expect(controller.getTags()).resolves.toEqual(tags);
    expect(assetsService.getTags).toHaveBeenCalledTimes(1);
  });

  it('uses default pagination when list query params are missing', async () => {
    const response = { items: [], total: 0 };
    assetsService.findPublished.mockResolvedValue(response as never);

    await expect(controller.list()).resolves.toEqual(response);
    expect(assetsService.findPublished).toHaveBeenCalledWith(0, 20);
  });

  it('delegates list query params to AssetsService', async () => {
    const response = { items: [], total: 0 };
    assetsService.findPublished.mockResolvedValue(response as never);

    await expect(controller.list(5, 10)).resolves.toEqual(response);
    expect(assetsService.findPublished).toHaveBeenCalledWith(5, 10);
  });

  it('returns an empty array when mine has no creator', async () => {
    await expect(controller.mine()).resolves.toEqual([]);
    expect(assetsService.findByCreator).not.toHaveBeenCalled();
  });

  it('delegates mine requests with a creator', async () => {
    const assets = [{ id: 'asset-1' }];
    assetsService.findByCreator.mockResolvedValue(assets as never);

    await expect(controller.mine('GBCREATOR...')).resolves.toEqual(assets);
    expect(assetsService.findByCreator).toHaveBeenCalledWith('GBCREATOR...');
  });

  it('delegates getById to AssetsService', async () => {
    const asset = { id: 'asset-1' };
    assetsService.findById.mockResolvedValue(asset as never);

    await expect(controller.getById('asset-1')).resolves.toEqual(asset);
    expect(assetsService.findById).toHaveBeenCalledWith('asset-1');
  });

  it('uses a placeholder creator when create is called without creator query', async () => {
    const dto = { name: 'Alpha', type: AssetType.AGENT };
    const created = { id: 'asset-1' };
    assetsService.create.mockResolvedValue(created as never);

    await expect(controller.create(dto as never)).resolves.toEqual(created);
    expect(assetsService.create).toHaveBeenCalledWith(dto, 'creator-placeholder');
  });

  it('delegates create with an explicit creator', async () => {
    const dto = { name: 'Alpha', type: AssetType.AGENT };
    const created = { id: 'asset-1' };
    assetsService.create.mockResolvedValue(created as never);

    await expect(controller.create(dto as never, 'GBCREATOR...')).resolves.toEqual(created);
    expect(assetsService.create).toHaveBeenCalledWith(dto, 'GBCREATOR...');
  });
});
