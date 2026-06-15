import {
  Controller,
  Get,
  Query,
  Logger,
} from '@nestjs/common';
import {
  DashboardService,
} from './dashboard.service';
import { DashboardMetricsDto } from './dto/dashboard-metrics.dto';
import { TopAssetDto } from './dto/top-asset.dto';
import { ActivityLogDto } from './dto/activity-log.dto';

@Controller('dashboard')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  async getMetrics(
    @Query('creator') creator?: string,
  ): Promise<DashboardMetricsDto> {
    return this.dashboardService.getMetrics(creator);
  }

  @Get('top-assets')
  async getTopAssets(
    @Query('creator') creator?: string,
    @Query('limit') limit?: number,
  ): Promise<TopAssetDto[]> {
    return this.dashboardService.getTopAssets(creator, limit ?? 5);
  }

  @Get('activity-logs')
  async getActivityLogs(
    @Query('creator') creator?: string,
    @Query('limit') limit?: number,
  ): Promise<ActivityLogDto[]> {
    return this.dashboardService.getActivityLogs(creator, limit ?? 20);
  }
}
