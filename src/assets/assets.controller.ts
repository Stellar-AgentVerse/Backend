import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { AssetResponseDto, AssetListResponseDto } from './dto/asset-response.dto';

@Controller('assets')
export class AssetsController {
  private readonly logger = new Logger(AssetsController.name);

  constructor(private readonly assetsService: AssetsService) {}

  @Get('types')
  async getTypes() {
    return this.assetsService.getAssetTypes();
  }

  @Get('tags')
  async getTags() {
    return this.assetsService.getTags();
  }

  @Get()
  async list(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ): Promise<AssetListResponseDto> {
    return this.assetsService.findPublished(skip ?? 0, take ?? 20);
  }

  @Get('mine')
  async mine(
    @Query('creator') creator?: string,
  ): Promise<AssetResponseDto[]> {
    if (!creator) return [];
    return this.assetsService.findByCreator(creator);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<AssetResponseDto> {
    return this.assetsService.findById(id);
  }

  @Post()
  async create(
    @Body() dto: CreateAssetDto,
    @Query('creator') creator?: string,
  ): Promise<AssetResponseDto> {
    const publicKey = creator || 'creator-placeholder';
    this.logger.log(`Creating asset for ${publicKey}`);
    return this.assetsService.create(dto, publicKey);
  }
}
