import { AssetType, AssetStatus } from '../../database/entities';

export class AssetMetricDto {
  executions: number;
  revenue: number;
  activeUsers: number;
  rating: number;
  reliability: number;
}

export class AssetCapabilityDto {
  icon: string;
  title: string;
  description: string;
  sortOrder: number;
}

export class AssetWorkflowStepDto {
  stepOrder: number;
  icon: string;
  label: string;
  isActive: boolean;
  isFilled: boolean;
}

export class AssetSpecDto {
  parameter: string;
  value: string;
  notes: string;
  sortOrder: number;
}

export class AssetResponseDto {
  id: string;
  name: string;
  slug: string;
  description: string;
  type: AssetType;
  creatorPublicKey: string;
  price: number;
  status: AssetStatus;
  imageUrl: string;
  tags: string[] | null;
  createdAt: Date;
  updatedAt: Date;

  metrics?: AssetMetricDto;
  capabilities?: AssetCapabilityDto[];
  workflow?: AssetWorkflowStepDto[];
  specs?: AssetSpecDto[];
}

export class AssetListResponseDto {
  items: AssetResponseDto[];
  total: number;
}
