import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { AssetResponseDto, AssetListResponseDto } from './dto/asset-response.dto';

@ApiTags('assets')
@Controller('assets')
export class AssetsController {
  private readonly logger = new Logger(AssetsController.name);

  constructor(private readonly assetsService: AssetsService) {}

  @Get('types')
  @ApiOperation({ summary: 'List asset types' })
  @ApiResponse({ status: 200, type: [String] })
  async getTypes() {
    return this.assetsService.getAssetTypes();
  }

  @Get('tags')
  @ApiOperation({ summary: 'List asset tags' })
  @ApiResponse({ status: 200, type: [String] })
  async getTags() {
    return this.assetsService.getTags();
  }

  @Get()
  @ApiOperation({ summary: 'List published assets' })
  @ApiQuery({ name: 'skip', required: false, example: 0 })
  @ApiQuery({ name: 'take', required: false, example: 20 })
  @ApiResponse({ status: 200, type: AssetListResponseDto })
  async list(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ): Promise<AssetListResponseDto> {
    return this.assetsService.findPublished(skip ?? 0, take ?? 20);
  }

  @Get('mine')
  @ApiOperation({ summary: 'List assets by creator' })
  @ApiQuery({ name: 'creator', required: false, example: 'GBTEST' })
  async mine(
    @Query('creator') creator?: string,
  ): Promise<AssetResponseDto[]> {
    if (!creator) return [];
    return this.assetsService.findByCreator(creator);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get asset by id' })
  @ApiParam({ name: 'id', example: 'b9f0c1f0-0000-0000-0000-000000000000' })
  async getById(@Param('id') id: string): Promise<AssetResponseDto> {
    return this.assetsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an asset' })
  @ApiBody({ type: CreateAssetDto })
  async create(
    @Body() dto: CreateAssetDto,
    @Query('creator') creator?: string,
  ): Promise<AssetResponseDto> {
    const publicKey = creator || 'creator-placeholder';
    this.logger.log(`Creating asset for ${publicKey}`);
    return this.assetsService.create(dto, publicKey);
  }
}
