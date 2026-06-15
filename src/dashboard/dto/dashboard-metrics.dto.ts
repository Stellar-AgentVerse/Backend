import { ApiProperty } from '@nestjs/swagger';

export class DashboardMetricsDto {
  @ApiProperty()
  totalRevenue: number;
  @ApiProperty()
  assetsPublished: number;
  @ApiProperty()
  totalExecutions: number;
  @ApiProperty()
  reliability: string;
  @ApiProperty()
  revenueTrend: string;
  @ApiProperty()
  pendingVerification: number;
}
