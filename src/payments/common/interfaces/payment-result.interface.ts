import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentResult {
  @ApiProperty()
  success: boolean;
  @ApiProperty()
  transactionId: string;
  @ApiProperty()
  amount: number;
  @ApiProperty()
  currency: string;
  @ApiProperty()
  provider: string;
  @ApiProperty()
  timestamp: Date;
  @ApiPropertyOptional({ type: Object })
  metadata?: Record<string, any>;
  @ApiPropertyOptional()
  error?: string;
}
