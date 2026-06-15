import {
  Controller,
  Get,
  Query,
  Logger,
} from '@nestjs/common';
import { MarketplaceService, MarketplaceItemDto } from './marketplace.service';

@Controller('marketplace')
export class MarketplaceController {
  private readonly logger = new Logger(MarketplaceController.name);

  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('assets')
  async search(
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ): Promise<{ items: MarketplaceItemDto[]; total: number }> {
    return this.marketplaceService.search(search, type, skip ?? 0, take ?? 20);
  }

  @Get('featured')
  async getFeatured(
    @Query('limit') limit?: number,
  ): Promise<MarketplaceItemDto[]> {
    return this.marketplaceService.getFeatured(limit ?? 10);
  }

  @Get('trending')
  async getTrending(
    @Query('limit') limit?: number,
  ): Promise<MarketplaceItemDto[]> {
    return this.marketplaceService.getTrending(limit ?? 20);
  }

  @Get('categories')
  async getCategories() {
    return this.marketplaceService.getCategories();
  }
}
