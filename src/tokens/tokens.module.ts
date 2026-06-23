import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TokensService } from './tokens.service';
import { SorobanSigningService } from './soroban-signing.service';
import { SorobanTxService } from './soroban-tx.service';
import { sorobanConfig } from './config/soroban.config';

@Module({
  imports: [ConfigModule.forFeature(sorobanConfig)],
  providers: [TokensService, SorobanSigningService, SorobanTxService],
  exports: [TokensService, SorobanSigningService, SorobanTxService],
})
export class TokensModule {}
