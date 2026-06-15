import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { getValidatedEnv } from '../config/env.validation';
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

const env = getValidatedEnv();

export const dataSourceOptions = {
  type: 'postgres' as const,
  host: env.db.host,
  port: env.db.port,
  username: env.db.username,
  password: env.db.password,
  database: env.db.database,
  entities: [
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
  ],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: env.db.logging,
};

export const AppDataSource = new DataSource(dataSourceOptions);
