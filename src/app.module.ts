import { Module } from '@nestjs/common';
import { PaymentsModule } from './payments/payments.module';
import { TokensModule } from './tokens/tokens.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { sorobanConfig } from './tokens/config/soroban.config';
import { jwtConfig } from './config/jwt.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [sorobanConfig, jwtConfig]
    }),
    PaymentsModule,
    TokensModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
