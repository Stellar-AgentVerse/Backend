import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OperatorGuard } from '../../auth/guards/operator.guard';
import { OperatorRegistry } from '../../auth/operator.registry';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/common/interfaces/jwt-payload.interface';
import { PromptPublicationService } from './prompt-publication.service';
import {
  CreatePublicationDto,
  PublicationResponseDto,
  ReviewPublicationDto,
} from './dto';

@ApiTags('prompt-publication')
@ApiBearerAuth()
@Controller('assets/:id/publication')
@UseGuards(JwtAuthGuard)
export class PromptPublicationController {
  constructor(
    private readonly publicationService: PromptPublicationService,
    private readonly operators: OperatorRegistry,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Open a curated publication draft (creator only)' })
  @ApiParam({ name: 'id', example: 'b9f0c1f0-0000-0000-0000-000000000000' })
  @ApiBody({ type: CreatePublicationDto })
  @ApiResponse({ status: 201, type: PublicationResponseDto })
  async create(
    @Param('id') assetId: string,
    @Body() dto: CreatePublicationDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PublicationResponseDto> {
    const publication = await this.publicationService.create(
      assetId,
      user.publicKey,
      dto.priceAtomic,
    );
    return PublicationResponseDto.from(publication);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit the draft for review (creator only)' })
  @ApiParam({ name: 'id', example: 'b9f0c1f0-0000-0000-0000-000000000000' })
  @ApiResponse({ status: 201, type: PublicationResponseDto })
  async submit(
    @Param('id') assetId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<PublicationResponseDto> {
    const publication = await this.publicationService.submit(
      assetId,
      user.publicKey,
    );
    return PublicationResponseDto.from(publication);
  }

  @Post('review')
  @UseGuards(OperatorGuard)
  @ApiOperation({
    summary: 'Approve or reject a submitted draft (operator only)',
  })
  @ApiParam({ name: 'id', example: 'b9f0c1f0-0000-0000-0000-000000000000' })
  @ApiBody({ type: ReviewPublicationDto })
  @ApiResponse({ status: 201, type: PublicationResponseDto })
  async review(
    @Param('id') assetId: string,
    @Body() dto: ReviewPublicationDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PublicationResponseDto> {
    const publication = await this.publicationService.review(
      assetId,
      user.publicKey,
      dto.approve,
      dto.reason,
    );
    return PublicationResponseDto.from(publication);
  }

  @Get()
  @ApiOperation({ summary: 'Read publication state (creator or operator)' })
  @ApiParam({ name: 'id', example: 'b9f0c1f0-0000-0000-0000-000000000000' })
  @ApiResponse({ status: 200, type: PublicationResponseDto })
  async findOne(
    @Param('id') assetId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<PublicationResponseDto> {
    const publication = await this.publicationService.findForActor(
      assetId,
      user.publicKey,
      this.operators.isOperator(user.publicKey),
    );
    return PublicationResponseDto.from(publication);
  }
}
