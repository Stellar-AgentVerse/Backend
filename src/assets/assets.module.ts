import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsController } from './assets.controller';
import { AssetsService } from './assets.service';
import {
  Asset,
  AssetMetric,
  AssetCapability,
  AssetWorkflowStep,
  AssetSpec,
  Tag,
} from '../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asset,
      AssetMetric,
      AssetCapability,
      AssetWorkflowStep,
      AssetSpec,
      Tag,
    ]),
  ],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
