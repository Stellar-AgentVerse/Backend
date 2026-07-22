import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmPurchaseDto {
  @ApiProperty({ example: 'a1b2c3d4e5f6...' })
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  transactionHash: string;
}
