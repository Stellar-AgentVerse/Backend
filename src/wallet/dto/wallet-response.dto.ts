import { IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '../../database/entities';

export class WalletBalanceDto {
  @ApiProperty()
  credits: number;
  @ApiProperty()
  xlmBalance: number;
  @ApiProperty()
  monthlyUsage: number;
  @ApiProperty()
  monthlyAllocation: number;
  @ApiProperty()
  usagePercent: number;
  @ApiProperty()
  xlmUsdEstimate: number;
}

export class CreditPackageDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  slug: string;
  @ApiProperty()
  description: string;
  @ApiProperty()
  icon: string;
  @ApiProperty()
  credits: number;
  @ApiProperty()
  price: number;
  @ApiPropertyOptional({ nullable: true })
  originalPrice: number | null;
  @ApiPropertyOptional({ nullable: true, type: [String] })
  features: string[] | null;
  @ApiProperty()
  popular: boolean;
}

export class WalletTransactionDto {
  @ApiProperty()
  id: string;
  @ApiProperty({ enum: TransactionType })
  type: TransactionType;
  @ApiProperty()
  description: string;
  @ApiProperty()
  txid: string;
  @ApiProperty()
  amount: number;
  @ApiProperty()
  currency: string;
  @ApiProperty()
  createdAt: Date;
}

export class PurchasePackageDto {
  @ApiProperty({ example: 'package-1' })
  @IsString()
  packageId: string;
}

export class PurchaseResultDto {
  @ApiProperty({ type: WalletTransactionDto })
  transaction: WalletTransactionDto;
  @ApiProperty()
  credits: number;
  @ApiProperty()
  message: string;
}
