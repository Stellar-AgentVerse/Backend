import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateRefundDto {
  @IsString()
  transactionId: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  provider?: string;
}
