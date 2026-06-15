import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ChallengeDto } from './common/dto/challenge.dto';
import { VerifyWalletDto } from './common/dto/verify-wallet.dto';
import { AuthResult } from './common/interfaces/auth-result.interface';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('challenge')
  @HttpCode(HttpStatus.OK)
  async getChallenge(
    @Body() challengeDto: ChallengeDto,
  ): Promise<{ challenge: string }> {
    this.logger.log(`Challenge requested for ${challengeDto.publicKey}`);
    return this.authService.generateChallenge(challengeDto.publicKey);
  }

  @Post('wallet')
  @HttpCode(HttpStatus.OK)
  async verifyWallet(
    @Body() verifyWalletDto: VerifyWalletDto,
  ): Promise<AuthResult> {
    this.logger.log(`Wallet verification for ${verifyWalletDto.publicKey}`);
    return this.authService.verifyWallet(
      verifyWalletDto.publicKey,
      verifyWalletDto.signature,
    );
  }
}
