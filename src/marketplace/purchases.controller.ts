import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/common/interfaces/jwt-payload.interface';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchaseIntentDto } from './dto/purchase-intent.dto';
import { ConfirmPurchaseDto } from './dto/confirm-purchase.dto';
import { PurchaseAccessDto } from './dto/purchase-access.dto';

@ApiTags('marketplace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('marketplace/purchases')
export class PurchasesController {
  private readonly logger = new Logger(PurchasesController.name);

  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a purchase intent for a published PROMPT asset' })
  @ApiBody({ type: CreatePurchaseDto })
  @ApiResponse({
    status: 201,
    description: 'Purchase intent created with unsigned XDR for wallet signing',
    type: PurchaseIntentDto,
  })
  async createIntent(
    @Body() dto: CreatePurchaseDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PurchaseIntentDto> {
    return this.purchasesService.createIntent(
      dto.assetId,
      user.publicKey,
      dto.idempotencyKey,
    );
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a purchase by submitting the on-chain transaction hash' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: ConfirmPurchaseDto })
  @ApiResponse({
    status: 200,
    description: 'Purchase confirmed and settled',
  })
  async confirm(
    @Param('id') id: string,
    @Body() dto: ConfirmPurchaseDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ purchaseId: string; status: string }> {
    return this.purchasesService.confirm(id, dto.transactionHash, user.publicKey);
  }

  @Get(':id/access')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get access to a settled purchase' })
  @ApiParam({ name: 'id' })
  @ApiResponse({
    status: 200,
    description: 'Delivery reference for the purchased content',
    type: PurchaseAccessDto,
  })
  async getAccess(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<PurchaseAccessDto> {
    return this.purchasesService.getAccess(id, user.publicKey);
  }
}
