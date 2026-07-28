import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { AssetResponseDto, AssetListResponseDto } from './dto/asset-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/common/interfaces/jwt-payload.interface';

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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create an asset (JWT required)' })
  @ApiBody({ type: CreateAssetDto })
  async create(
    @Body() dto: CreateAssetDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AssetResponseDto> {
    this.logger.log(`Creating asset for ${user.publicKey}`);
    return this.assetsService.create(dto, user.publicKey);
  }
}
