import { IsNumber, IsString, IsOptional, IsObject, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ example: 12.5 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: 'USD' })
  @IsString()
  currency: string;

  @ApiPropertyOptional({ example: 'Checkout purchase' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: { email: 'alice@example.com' } })
  @IsOptional()
  @IsObject()
  customer?: {
    email?: string;
    name?: string;
  };

  @ApiPropertyOptional({ example: { orderId: 'ord_123' } })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ example: 'stripe' })
  @IsOptional()
  @IsString()
  provider?: string;
}
