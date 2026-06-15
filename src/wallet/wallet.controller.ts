import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { PurchasePackageDto } from './dto/wallet-response.dto';
import {
  WalletBalanceDto,
  CreditPackageDto,
  WalletTransactionDto,
  PurchaseResultDto,
} from './dto/wallet-response.dto';

@Controller('wallet')
export class WalletController {
  private readonly logger = new Logger(WalletController.name);

  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  async getBalance(
    @Query('user') user?: string,
  ): Promise<WalletBalanceDto> {
    const publicKey = user || 'anon-placeholder';
    return this.walletService.getBalance(publicKey);
  }

  @Get('packages')
  async getPackages(): Promise<CreditPackageDto[]> {
    return this.walletService.getPackages();
  }

  @Get('transactions')
  async getTransactions(
    @Query('user') user?: string,
    @Query('limit') limit?: number,
    @Query('skip') skip?: number,
  ): Promise<WalletTransactionDto[]> {
    const publicKey = user || 'anon-placeholder';
    return this.walletService.getTransactions(publicKey, limit ?? 20, skip ?? 0);
  }

  @Post('purchase')
  async purchase(
    @Body() dto: PurchasePackageDto,
    @Query('user') user?: string,
  ): Promise<PurchaseResultDto> {
    const publicKey = user || 'anon-placeholder';
    this.logger.log(`Purchase request: package=${dto.packageId}, user=${publicKey}`);
    return this.walletService.purchasePackage(publicKey, dto.packageId);
  }
}
