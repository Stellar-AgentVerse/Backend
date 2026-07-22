import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { Asset, AssetMetric } from '../database/entities';
import { Purchase } from '../database/entities/purchase.entity';
import { sorobanConfig } from '../tokens/config/soroban.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, AssetMetric, Purchase]),
    ConfigModule.forFeature(sorobanConfig),
  ],
  controllers: [MarketplaceController, PurchasesController],
  providers: [MarketplaceService, PurchasesService],
  exports: [MarketplaceService, PurchasesService],
})
export class MarketplaceModule {}
