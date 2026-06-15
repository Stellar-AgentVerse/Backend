import { Test, TestingModule } from '@nestjs/testing';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

describe('MarketplaceController', () => {
  let controller: MarketplaceController;
  let marketplaceService: jest.Mocked<MarketplaceService>;

  beforeEach(async () => {
    const marketplaceServiceMock = {
      search: jest.fn(),
      getFeatured: jest.fn(),
      getTrending: jest.fn(),
      getCategories: jest.fn(),
    } as unknown as jest.Mocked<MarketplaceService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketplaceController],
      providers: [{ provide: MarketplaceService, useValue: marketplaceServiceMock }],
    }).compile();

    controller = module.get(MarketplaceController);
    marketplaceService = module.get(MarketplaceService) as jest.Mocked<MarketplaceService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delegates search requests with default paging', async () => {
    const response = { items: [], total: 0 };
    marketplaceService.search.mockResolvedValue(response as never);

    await expect(controller.search('agent', 'MODEL')).resolves.toEqual(response);
    expect(marketplaceService.search).toHaveBeenCalledWith('agent', 'MODEL', 0, 20);
  });

  it('delegates featured requests with the default limit', async () => {
    const featured = [{ id: 'asset-1' }];
    marketplaceService.getFeatured.mockResolvedValue(featured as never);

    await expect(controller.getFeatured()).resolves.toEqual(featured);
    expect(marketplaceService.getFeatured).toHaveBeenCalledWith(10);
  });

  it('delegates trending requests with the provided limit', async () => {
    const trending = [{ id: 'asset-1' }];
    marketplaceService.getTrending.mockResolvedValue(trending as never);

    await expect(controller.getTrending(3)).resolves.toEqual(trending);
    expect(marketplaceService.getTrending).toHaveBeenCalledWith(3);
  });

  it('delegates categories requests', async () => {
    const categories = [{ label: 'Agents' }];
    marketplaceService.getCategories.mockResolvedValue(categories as never);

    await expect(controller.getCategories()).resolves.toEqual(categories);
    expect(marketplaceService.getCategories).toHaveBeenCalledTimes(1);
  });
});
