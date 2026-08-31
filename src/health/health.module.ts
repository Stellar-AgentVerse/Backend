import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { sorobanConfig } from '../tokens/config/soroban.config';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [ConfigModule.forFeature(sorobanConfig)],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
