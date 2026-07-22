import { ApiProperty } from '@nestjs/swagger';

export class PurchaseAccessDto {
  @ApiProperty()
  purchaseId: string;

  @ApiProperty()
  assetId: string;

  @ApiProperty({ description: 'Delivery reference for the purchased content. Not plaintext content.' })
  deliveryReference: string;

  @ApiProperty()
  purchasedAt: Date;
}
