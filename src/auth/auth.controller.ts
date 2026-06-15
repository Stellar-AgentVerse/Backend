import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ChallengeDto } from './common/dto/challenge.dto';
import { VerifyWalletDto } from './common/dto/verify-wallet.dto';
import { AuthResult } from './common/interfaces/auth-result.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('challenge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a wallet challenge' })
  @ApiBody({ type: ChallengeDto })
  @ApiResponse({ status: 200, description: 'Challenge generated' })
  async getChallenge(
    @Body() challengeDto: ChallengeDto,
  ): Promise<{ challenge: string }> {
    this.logger.log(`Challenge requested for ${challengeDto.publicKey}`);
    return this.authService.generateChallenge(challengeDto.publicKey);
  }

  @Post('wallet')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify a wallet signature and issue a JWT' })
  @ApiBody({ type: VerifyWalletDto })
  @ApiResponse({ status: 200, description: 'Wallet verified', type: AuthResult })
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
