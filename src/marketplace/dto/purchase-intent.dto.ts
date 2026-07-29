import { ApiProperty } from '@nestjs/swagger';

export class PurchaseIntentDto {
  @ApiProperty()
  purchaseId: string;

  @ApiProperty({ description: 'Unsigned Stellar transaction XDR (base64) for the wallet to sign and submit' })
  unsignedXdr: string;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty()
  contractId: string;

  @ApiProperty()
  networkPassphrase: string;

  @ApiProperty()
  assetId: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  idempotencyKey: string;
}
