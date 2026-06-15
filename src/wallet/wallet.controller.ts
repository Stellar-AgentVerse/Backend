import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { PurchasePackageDto } from './dto/wallet-response.dto';
import {
  WalletBalanceDto,
  CreditPackageDto,
  WalletTransactionDto,
  PurchaseResultDto,
} from './dto/wallet-response.dto';

@ApiTags('wallet')
@Controller('wallet')
export class WalletController {
  private readonly logger = new Logger(WalletController.name);

  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get wallet balance' })
  @ApiQuery({ name: 'user', required: false, example: 'GBTEST' })
  @ApiResponse({ status: 200, type: WalletBalanceDto })
  async getBalance(
    @Query('user') user?: string,
  ): Promise<WalletBalanceDto> {
    const publicKey = user || 'anon-placeholder';
    return this.walletService.getBalance(publicKey);
  }

  @Get('packages')
  @ApiOperation({ summary: 'List credit packages' })
  @ApiResponse({ status: 200, type: [CreditPackageDto] })
  async getPackages(): Promise<CreditPackageDto[]> {
    return this.walletService.getPackages();
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List wallet transactions' })
  @ApiQuery({ name: 'user', required: false, example: 'GBTEST' })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'skip', required: false, example: 0 })
  @ApiResponse({ status: 200, type: [WalletTransactionDto] })
  async getTransactions(
    @Query('user') user?: string,
    @Query('limit') limit?: number,
    @Query('skip') skip?: number,
  ): Promise<WalletTransactionDto[]> {
    const publicKey = user || 'anon-placeholder';
    return this.walletService.getTransactions(publicKey, limit ?? 20, skip ?? 0);
  }

  @Post('purchase')
  @ApiOperation({ summary: 'Purchase a credit package' })
  @ApiQuery({ name: 'user', required: false, example: 'GBTEST' })
  @ApiBody({ type: PurchasePackageDto })
  @ApiResponse({ status: 201, type: PurchaseResultDto })
  async purchase(
    @Body() dto: PurchasePackageDto,
    @Query('user') user?: string,
  ): Promise<PurchaseResultDto> {
    const publicKey = user || 'anon-placeholder';
    this.logger.log(`Purchase request: package=${dto.packageId}, user=${publicKey}`);
    return this.walletService.purchasePackage(publicKey, dto.packageId);
  }
}
