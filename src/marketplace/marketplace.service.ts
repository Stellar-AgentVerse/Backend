import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Asset, AssetMetric, AssetType } from '../database/entities';

export interface MarketplaceItemDto {
  id: string;
  title: string;
  slug: string;
  category: string;
  creator: string;
  creatorPublicKey: string;
  rating: string;
  price: string;
  priceValue: number;
  currency: string;
  tag: string;
  gradient: string;
  description: string;
  imageUrl: string;
  executions: number;
}

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    @InjectRepository(AssetMetric)
    private readonly metricRepo: Repository<AssetMetric>,
  ) {}

  async search(query?: string, type?: string, skip = 0, take = 20): Promise<{ items: MarketplaceItemDto[]; total: number }> {
    const qb = this.assetRepo.createQueryBuilder('a')
      .where('a.status = :status', { status: 'PUBLISHED' });

    if (query) {
      qb.andWhere('(a.name ILIKE :q OR a.description ILIKE :q)', { q: `%${query}%` });
    }
    if (type) {
      qb.andWhere('a.type = :type', { type });
    }

    qb.orderBy('a.createdAt', 'DESC')
      .skip(skip)
      .take(take);

    const [assets, total] = await qb.getMany();
    const items = await Promise.all(assets.map((a) => this.toItemDto(a)));
    return { items, total };
  }

  async getFeatured(limit = 10): Promise<MarketplaceItemDto[]> {
    const assets = await this.assetRepo.find({
      where: { status: 'PUBLISHED' as any },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return Promise.all(assets.map((a) => this.toItemDto(a)));
  }

  async getTrending(limit = 20): Promise<MarketplaceItemDto[]> {
    const assets = await this.assetRepo.find({
      where: { status: 'PUBLISHED' as any },
      order: { createdAt: 'DESC' },
      take: limit * 2,
    });

    // Sort by execution count desc (simulate trending)
    const withMetrics = await Promise.all(
      assets.map(async (a) => {
        const metric = await this.metricRepo.findOne({ where: { assetId: a.id } });
        return { asset: a, executions: metric ? Number(metric.executions) : 0 };
      }),
    );

    withMetrics.sort((a, b) => b.executions - a.executions);
    const top = withMetrics.slice(0, limit);
    return Promise.all(top.map((t) => this.toItemDto(t.asset)));
  }

  async getCategories(): Promise<{ label: string; icon: string; type: string }[]> {
    return [
      { label: 'Agents', icon: 'smart_toy', type: AssetType.AGENT },
      { label: 'Prompts', icon: 'terminal', type: AssetType.PROMPT },
      { label: 'Datasets', icon: 'database', type: AssetType.DATASET },
      { label: 'Workflows', icon: 'account_tree', type: AssetType.TOOL },
      { label: 'Models', icon: 'memory', type: AssetType.MODEL },
      { label: 'Oracles', icon: 'radar', type: AssetType.ORACLE },
    ];
  }

  private async toItemDto(asset: Asset): Promise<MarketplaceItemDto> {
    const metric = await this.metricRepo.findOne({ where: { assetId: asset.id } });
    const rating = metric ? Number(metric.rating) : 0;
    const executions = metric ? Number(metric.executions) : 0;

    const gradientMap: Record<string, string> = {
      AGENT: 'from-accent/10 to-transparent',
      WORKFLOW: 'from-secondary/10 to-transparent',
      DATASET: 'from-primary/10 to-transparent',
      PROMPT: 'from-accent/10 to-transparent',
      MODEL: 'from-secondary/10 to-transparent',
      TOOL: 'from-primary/10 to-transparent',
      ORACLE: 'from-accent/10 to-transparent',
    };

    const tagLabels: Record<string, string> = {
      AGENT: 'AGENT',
      PROMPT: 'PROMPT',
      DATASET: 'DATASET',
      MODEL: 'MODEL',
      TOOL: 'WORKFLOW',
      ORACLE: 'ORACLE',
    };

    const categoryLabels: Record<string, string> = {
      AGENT: 'Featured Agent',
      PROMPT: 'Top Prompt',
      DATASET: 'New Dataset',
      MODEL: 'Featured Model',
      TOOL: 'Top Workflow',
      ORACLE: 'New Oracle',
    };

    return {
      id: asset.id,
      title: asset.name,
      slug: asset.slug,
      category: categoryLabels[asset.type] || 'Featured Asset',
      creator: asset.creatorPublicKey.slice(0, 8) + '...',
      creatorPublicKey: asset.creatorPublicKey,
      rating: rating.toFixed(1),
      price: Number(asset.price) > 0 ? `${Number(asset.price)} Credits` : 'Free',
      priceValue: Number(asset.price),
      currency: 'Credits',
      tag: tagLabels[asset.type] || 'AGENT',
      gradient: gradientMap[asset.type] || 'from-accent/10 to-transparent',
      description: asset.description,
      imageUrl: asset.imageUrl,
      executions,
    };
  }
}
