import { IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '../../database/entities';

/**
 * Why the on-chain half of a wallet balance is not available.
 *
 * A single member today. It is an enum rather than a boolean so that a client
 * branch written now (`status !== 'AVAILABLE'`) keeps working when a real
 * Stellar balance integration lands and adds `AVAILABLE`.
 */
export enum OnChainBalanceStatus {
  UNAVAILABLE = 'UNAVAILABLE',
}

export const STELLAR_BALANCE_NOT_INTEGRATED = 'STELLAR_BALANCE_NOT_INTEGRATED';

export class OnChainBalanceDto {
  @ApiProperty({
    enum: OnChainBalanceStatus,
    description:
      'Whether a verified on-chain balance is available for this wallet.',
  })
  status: OnChainBalanceStatus;

  @ApiProperty({
    example: STELLAR_BALANCE_NOT_INTEGRATED,
    description: 'Stable machine-readable reason code.',
  })
  reason: string;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Verified XLM balance, or null when no verified balance is available. Never a simulated figure.',
  })
  xlmBalance: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'USD estimate of the verified XLM balance, or null when unavailable.',
  })
  xlmUsdEstimate: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'When the on-chain figures were last observed.',
  })
  asOf: string | null;
}

export class WalletBalanceDto {
  @ApiProperty({
    description:
      'First-party platform credits held by this wallet. Not a currency and not redeemable.',
  })
  credits: number;

  @ApiProperty()
  monthlyUsage: number;

  @ApiProperty()
  monthlyAllocation: number;

  @ApiProperty()
  usagePercent: number;

  @ApiProperty({ type: OnChainBalanceDto })
  onChain: OnChainBalanceDto;
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

  @ApiProperty({
    description:
      'Whether this package can currently be purchased. False while no settlement rail exists.',
  })
  purchasable: boolean;
}

export class PurchaseCapabilityDto {
  @ApiProperty({
    description: 'Whether POST /wallet/purchase will accept a purchase.',
  })
  supported: boolean;

  @ApiProperty({
    description:
      'Stable machine-readable reason code, matching the message returned by POST /wallet/purchase.',
  })
  reason: string;

  @ApiProperty({ description: 'Human-readable explanation, safe to display.' })
  message: string;
}

export class CreditPackagesDto {
  @ApiProperty({ type: PurchaseCapabilityDto })
  purchase: PurchaseCapabilityDto;

  @ApiProperty({ type: [CreditPackageDto] })
  packages: CreditPackageDto[];
}

export class WalletTransactionDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: TransactionType })
  type: TransactionType;

  @ApiProperty()
  description: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Verified Stellar transaction hash (64 lowercase hex characters), or null when this row has no verified on-chain reference.',
  })
  ledgerReference: string | null;

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
