import { ApiProperty } from '@nestjs/swagger';

export class MarketplaceItemDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  title: string;
  @ApiProperty()
  slug: string;
  @ApiProperty()
  category: string;
  @ApiProperty()
  creator: string;
  @ApiProperty()
  creatorPublicKey: string;
  @ApiProperty()
  rating: string;
  @ApiProperty()
  price: string;
  @ApiProperty()
  priceValue: number;
  @ApiProperty()
  currency: string;
  @ApiProperty()
  tag: string;
  @ApiProperty()
  gradient: string;
  @ApiProperty()
  description: string;
  @ApiProperty()
  imageUrl: string;
  @ApiProperty()
  executions: number;
}
