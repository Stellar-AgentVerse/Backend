import {
  Controller,
  Get,
  Query,
  Logger,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceItemDto } from './dto/marketplace-item.dto';

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {
  private readonly logger = new Logger(MarketplaceController.name);

  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('assets')
  @ApiOperation({ summary: 'Search marketplace assets' })
  @ApiQuery({ name: 'search', required: false, example: 'agent' })
  @ApiQuery({ name: 'type', required: false, example: 'AGENT' })
  @ApiQuery({ name: 'skip', required: false, example: 0 })
  @ApiQuery({ name: 'take', required: false, example: 20 })
  @ApiResponse({ status: 200, type: Object })
  async search(
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ): Promise<{ items: MarketplaceItemDto[]; total: number }> {
    return this.marketplaceService.search(search, type, skip ?? 0, take ?? 20);
  }

  @Get('featured')
  @ApiOperation({ summary: 'List featured assets' })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, type: [MarketplaceItemDto] })
  async getFeatured(
    @Query('limit') limit?: number,
  ): Promise<MarketplaceItemDto[]> {
    return this.marketplaceService.getFeatured(limit ?? 10);
  }

  @Get('trending')
  @ApiOperation({ summary: 'List trending assets' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, type: [MarketplaceItemDto] })
  async getTrending(
    @Query('limit') limit?: number,
  ): Promise<MarketplaceItemDto[]> {
    return this.marketplaceService.getTrending(limit ?? 20);
  }

  @Get('categories')
  @ApiOperation({ summary: 'List marketplace categories' })
  @ApiResponse({ status: 200, type: [String] })
  async getCategories() {
    return this.marketplaceService.getCategories();
  }
}
