import {
  Controller,
  Get,
  Query,
  Logger,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  DashboardService,
} from './dashboard.service';
import { DashboardMetricsDto } from './dto/dashboard-metrics.dto';
import { TopAssetDto } from './dto/top-asset.dto';
import { ActivityLogDto } from './dto/activity-log.dto';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get dashboard metrics' })
  @ApiQuery({ name: 'creator', required: false, example: 'GBTEST' })
  @ApiResponse({ status: 200, type: DashboardMetricsDto })
  async getMetrics(
    @Query('creator') creator?: string,
  ): Promise<DashboardMetricsDto> {
    return this.dashboardService.getMetrics(creator);
  }

  @Get('top-assets')
  @ApiOperation({ summary: 'Get top assets' })
  @ApiQuery({ name: 'creator', required: false, example: 'GBTEST' })
  @ApiQuery({ name: 'limit', required: false, example: 5 })
  @ApiResponse({ status: 200, type: [TopAssetDto] })
  async getTopAssets(
    @Query('creator') creator?: string,
    @Query('limit') limit?: number,
  ): Promise<TopAssetDto[]> {
    return this.dashboardService.getTopAssets(creator, limit ?? 5);
  }

  @Get('activity-logs')
  @ApiOperation({ summary: 'Get activity logs' })
  @ApiQuery({ name: 'creator', required: false, example: 'GBTEST' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, type: [ActivityLogDto] })
  async getActivityLogs(
    @Query('creator') creator?: string,
    @Query('limit') limit?: number,
  ): Promise<ActivityLogDto[]> {
    return this.dashboardService.getActivityLogs(creator, limit ?? 20);
  }
}
