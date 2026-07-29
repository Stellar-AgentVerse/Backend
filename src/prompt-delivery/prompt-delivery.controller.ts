import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/common/interfaces/jwt-payload.interface';
import { PromptDeliveryService } from './prompt-delivery.service';

@ApiTags('prompt-delivery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('prompt-delivery')
export class PromptDeliveryController {
  constructor(private readonly delivery: PromptDeliveryService) {}

  @Get(':purchaseId')
  async getResult(
    @Param('purchaseId') purchaseId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.delivery.getResult(purchaseId, user.publicKey);
  }
}
