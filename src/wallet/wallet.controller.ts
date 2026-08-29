import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  NotImplementedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/common/interfaces/jwt-payload.interface';
import { WalletService } from './wallet.service';
import {
  WalletBalanceDto,
  CreditPackagesDto,
  WalletTransactionDto,
} from './dto/wallet-response.dto';
import {
  CREDIT_PURCHASE_CAPABILITY,
  CREDIT_PURCHASE_NOT_AVAILABLE,
} from './wallet.capabilities';

/**
 * Wallet identity is derived from the authenticated principal only. There is
 * deliberately no route, query or body parameter anywhere in this controller
 * that names a wallet, so reading or mutating someone else's wallet is not
 * expressible rather than merely rejected.
 */
@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get the authenticated wallet balance (JWT required)',
  })
  @ApiResponse({ status: 200, type: WalletBalanceDto })
  @ApiResponse({
    status: 401,
    description: 'Missing, malformed or expired token',
  })
  async getBalance(@CurrentUser() user: JwtPayload): Promise<WalletBalanceDto> {
    return this.walletService.getBalance(user.publicKey);
  }

  /**
   * Public: returns catalogue data only, no wallet-specific state. A signed-out
   * client needs it to render the pricing page together with its disabled
   * state, which is what `purchase.supported === false` is for.
   */
  @Get('packages')
  @ApiOperation({
    summary: 'List credit packages and whether purchasing is supported',
  })
  @ApiResponse({ status: 200, type: CreditPackagesDto })
  async getPackages(): Promise<CreditPackagesDto> {
    return this.walletService.getPackages();
  }

  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List transactions for the authenticated wallet (JWT required)',
  })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'skip', required: false, example: 0 })
  @ApiResponse({ status: 200, type: [WalletTransactionDto] })
  @ApiResponse({
    status: 401,
    description: 'Missing, malformed or expired token',
  })
  async getTransactions(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: number,
    @Query('skip') skip?: number,
  ): Promise<WalletTransactionDto[]> {
    return this.walletService.getTransactions(user.publicKey, limit, skip);
  }

  /**
   * Kept as a route rather than deleted so that a client gets an explicit,
   * documented capability answer instead of a 404 it cannot distinguish from a
   * typo. 501 is used over 403 (which means "you specifically may not"), 503
   * (which invites a retry) and 410 (which generic clients report as a bad
   * request): the server does not implement this, and will not until a
   * settlement rail exists. See `wallet.capabilities.ts`.
   */
  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Purchase a credit package — not currently supported',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing, malformed or expired token',
  })
  @ApiResponse({
    status: 501,
    description: `Credit purchase is unavailable; message is the stable reason code ${CREDIT_PURCHASE_NOT_AVAILABLE}`,
  })
  purchase(): never {
    throw new NotImplementedException(CREDIT_PURCHASE_CAPABILITY.reason);
  }
}
