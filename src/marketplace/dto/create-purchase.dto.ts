import { IsUUID, IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePurchaseDto {
  @ApiProperty({ example: 'b9f0c1f0-0000-0000-0000-000000000000' })
  @IsUUID()
  assetId: string;

  @ApiPropertyOptional({ example: 'tx-idempotency-key-001' })
  @IsString()
  @IsOptional()
  @MinLength(8)
  @MaxLength(64)
  idempotencyKey?: string;
}
