import { Module } from '@nestjs/common';
import { PaymentsModule } from './payments/payments.module';
import { TokensModule } from './tokens/tokens.module';
import { ConfigModule } from '@nestjs/config';
import { sorobanConfig } from './tokens/config/soroban.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [sorobanConfig]
    }),
    PaymentsModule,
    TokensModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
