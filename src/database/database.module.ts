import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { typeormConfig } from './typeorm.config';
import {
  User,
  Asset,
  AssetMetric,
  AssetCapability,
  AssetWorkflowStep,
  AssetSpec,
  Wallet,
  CreditPackage,
  WalletTransaction,
  ActivityLog,
  UserAsset,
  Tag,
} from './entities';

const entities = [
  User,
  Asset,
  AssetMetric,
  AssetCapability,
  AssetWorkflowStep,
  AssetSpec,
  Wallet,
  CreditPackage,
  WalletTransaction,
  ActivityLog,
  UserAsset,
  Tag,
];

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(typeormConfig),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.get('typeorm')!;
        return {
          type: 'postgres',
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          entities,
          synchronize: db.synchronize,
          logging: db.logging,
        };
      },
    }),
    TypeOrmModule.forFeature(entities),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
