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
  PromptPublication,
} from '../database/entities';
import { PromptPublicationController } from './publication/prompt-publication.controller';
import { PromptPublicationService } from './publication/prompt-publication.service';
import { OperatorRegistry } from '../auth/operator.registry';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Asset,
      AssetMetric,
      AssetCapability,
      AssetWorkflowStep,
      AssetSpec,
      Tag,
      PromptPublication,
    ]),
  ],
  controllers: [AssetsController, PromptPublicationController],
  providers: [AssetsService, PromptPublicationService, OperatorRegistry],
  exports: [AssetsService, PromptPublicationService],
})
export class AssetsModule {}
