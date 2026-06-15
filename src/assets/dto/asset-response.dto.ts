import { AssetType, AssetStatus } from '../../database/entities';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssetMetricDto {
  @ApiProperty()
  executions: number;
  @ApiProperty()
  revenue: number;
  @ApiProperty()
  activeUsers: number;
  @ApiProperty()
  rating: number;
  @ApiProperty()
  reliability: number;
}

export class AssetCapabilityDto {
  @ApiProperty()
  icon: string;
  @ApiProperty()
  title: string;
  @ApiProperty()
  description: string;
  @ApiProperty()
  sortOrder: number;
}

export class AssetWorkflowStepDto {
  @ApiProperty()
  stepOrder: number;
  @ApiProperty()
  icon: string;
  @ApiProperty()
  label: string;
  @ApiProperty()
  isActive: boolean;
  @ApiProperty()
  isFilled: boolean;
}

export class AssetSpecDto {
  @ApiProperty()
  parameter: string;
  @ApiProperty()
  value: string;
  @ApiProperty()
  notes: string;
  @ApiProperty()
  sortOrder: number;
}

export class AssetResponseDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  slug: string;
  @ApiProperty()
  description: string;
  @ApiProperty({ enum: AssetType })
  type: AssetType;
  @ApiProperty()
  creatorPublicKey: string;
  @ApiProperty()
  price: number;
  @ApiProperty({ enum: AssetStatus })
  status: AssetStatus;
  @ApiProperty()
  imageUrl: string;
  @ApiPropertyOptional({ type: [String], nullable: true })
  tags: string[] | null;
  @ApiProperty()
  createdAt: Date;
  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: AssetMetricDto })
  metrics?: AssetMetricDto;
  @ApiPropertyOptional({ type: [AssetCapabilityDto] })
  capabilities?: AssetCapabilityDto[];
  @ApiPropertyOptional({ type: [AssetWorkflowStepDto] })
  workflow?: AssetWorkflowStepDto[];
  @ApiPropertyOptional({ type: [AssetSpecDto] })
  specs?: AssetSpecDto[];
}

export class AssetListResponseDto {
  @ApiProperty({ type: [AssetResponseDto] })
  items: AssetResponseDto[];
  @ApiProperty()
  total: number;
}
