import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TokensService } from './tokens.service';
import { sorobanConfig } from './config/soroban.config';

@Module({
  imports: [ConfigModule.forFeature(sorobanConfig)],
  providers: [TokensService],
  exports: [TokensService],
})
export class TokensModule {}
