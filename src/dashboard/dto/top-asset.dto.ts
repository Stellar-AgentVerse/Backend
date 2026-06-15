import { ApiProperty } from '@nestjs/swagger';

export class TopAssetDto {
  @ApiProperty()
  name: string;
  @ApiProperty()
  category: string;
  @ApiProperty()
  revenue: string;
  @ApiProperty()
  calls: string;
  @ApiProperty()
  gradient: string;
  @ApiProperty()
  assetId: string;
}
