import { Module } from '@nestjs/common';
import { PaymentsModule } from './payments/payments.module';
import { TokensModule } from './tokens/tokens.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { sorobanConfig } from './tokens/config/soroban.config';
import { jwtConfig } from './config/jwt.config';
import { DatabaseModule } from './database/database.module';
import { IndexerModule } from './indexer/indexer.module';
import { AssetsModule } from './assets/assets.module';
import { WalletModule } from './wallet/wallet.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [sorobanConfig, jwtConfig]
    }),
    DatabaseModule,
    PaymentsModule,
    TokensModule,
    AuthModule,
    IndexerModule,
    AssetsModule,
    WalletModule,
    MarketplaceModule,
    DashboardModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
