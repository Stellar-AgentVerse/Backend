import { IsString } from 'class-validator';
import { TransactionType } from '../../database/entities';

export class WalletBalanceDto {
  credits: number;
  xlmBalance: number;
  monthlyUsage: number;
  monthlyAllocation: number;
  usagePercent: number;
  xlmUsdEstimate: number;
}

export class CreditPackageDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  credits: number;
  price: number;
  originalPrice: number | null;
  features: string[] | null;
  popular: boolean;
}

export class WalletTransactionDto {
  id: string;
  type: TransactionType;
  description: string;
  txid: string;
  amount: number;
  currency: string;
  createdAt: Date;
}

export class PurchasePackageDto {
  @IsString()
  packageId: string;
}

export class PurchaseResultDto {
  transaction: WalletTransactionDto;
  credits: number;
  message: string;
}
