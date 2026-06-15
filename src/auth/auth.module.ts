import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { InMemoryChallengeStore } from './stores/in-memory-challenge.store';
import { InMemoryUserRepository } from './repositories/in-memory-user.repository';
import { CHALLENGE_STORE, USER_REPOSITORY } from './common/auth-tokens';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret') || 'dev-secret',
        signOptions: {
          expiresIn: (configService.get<string>('jwt.expiresIn') || '24h') as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    {
      provide: CHALLENGE_STORE,
      useClass: InMemoryChallengeStore,
    },
    {
      provide: USER_REPOSITORY,
      useClass: InMemoryUserRepository,
    },
  ],
  exports: [JwtAuthGuard, JwtModule],
})
export class AuthModule {}
