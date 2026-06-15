import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { Asset, AssetMetric, ActivityLog } from '../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, AssetMetric, ActivityLog]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
