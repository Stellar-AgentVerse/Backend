import { ApiProperty } from '@nestjs/swagger';

export class ActivityLogDto {
  @ApiProperty()
  event: string;
  @ApiProperty()
  asset: string;
  @ApiProperty()
  status: string;
  @ApiProperty()
  statusClass: string;
  @ApiProperty()
  revenue: string;
  @ApiProperty()
  time: string;
}
