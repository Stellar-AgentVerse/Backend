import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset, AssetMetric, ActivityLog } from '../database/entities';
import { DashboardMetricsDto } from './dto/dashboard-metrics.dto';
import { TopAssetDto } from './dto/top-asset.dto';
import { ActivityLogDto } from './dto/activity-log.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    @InjectRepository(AssetMetric)
    private readonly metricRepo: Repository<AssetMetric>,
    @InjectRepository(ActivityLog)
    private readonly logRepo: Repository<ActivityLog>,
  ) {}

  async getMetrics(creatorPublicKey?: string): Promise<DashboardMetricsDto> {
    const where = creatorPublicKey ? { creatorPublicKey } : {};

    const assets = await this.assetRepo.find({ where: { ...where, status: 'PUBLISHED' as any } });
    const assetIds = assets.map((a) => a.id);

    const totalRevenue = assetIds.length > 0
      ? await this.metricRepo
          .createQueryBuilder('m')
          .select('COALESCE(SUM(m.revenue), 0)', 'total')
          .where('m.assetId IN (:...ids)', { ids: assetIds })
          .getRawOne()
          .then((r) => Number(r?.total ?? 0))
      : 0;

    const totalExecutions = assetIds.length > 0
      ? await this.metricRepo
          .createQueryBuilder('m')
          .select('COALESCE(SUM(m.executions), 0)', 'total')
          .where('m.assetId IN (:...ids)', { ids: assetIds })
          .getRawOne()
          .then((r) => Number(r?.total ?? 0))
      : 0;

    const pendingVerification = await this.assetRepo.count({
      where: { ...where, status: 'PENDING' as any },
    });

    return {
      totalRevenue,
      assetsPublished: assets.length,
      totalExecutions,
      reliability: '99.9',
      revenueTrend: '+12.4',
      pendingVerification,
    };
  }

  async getTopAssets(creatorPublicKey?: string, limit = 5): Promise<TopAssetDto[]> {
    const where = creatorPublicKey ? { creatorPublicKey } : {};
    const assets = await this.assetRepo.find({
      where: { ...where, status: 'PUBLISHED' as any },
      take: limit * 2,
    });

    const withRevenue = await Promise.all(
      assets.map(async (a) => {
        const metric = await this.metricRepo.findOne({ where: { assetId: a.id } });
        return {
          asset: a,
          revenue: metric ? Number(metric.revenue) : 0,
          executions: metric ? Number(metric.executions) : 0,
        };
      }),
    );

    withRevenue.sort((a, b) => b.revenue - a.revenue);
    const top = withRevenue.slice(0, limit);

    const gradientPool = [
      'from-secondary/20 to-transparent',
      'from-primary/10 to-transparent',
      'from-accent/10 to-transparent',
      'from-secondary/10 to-transparent',
      'from-primary/20 to-transparent',
    ];

    return top.map((t, i) => ({
      name: t.asset.name,
      category: t.asset.type,
      revenue: `${t.revenue.toLocaleString()} XLM`,
      calls: `${t.executions.toLocaleString()} calls`,
      gradient: gradientPool[i % gradientPool.length],
      assetId: t.asset.id,
    }));
  }

  async getActivityLogs(creatorPublicKey?: string, limit = 20): Promise<ActivityLogDto[]> {
    const where: any = {};
    if (creatorPublicKey) where.userPublicKey = creatorPublicKey;

    let logs: ActivityLog[];
    if (creatorPublicKey) {
      logs = await this.logRepo.find({
        where: { userPublicKey: creatorPublicKey },
        order: { createdAt: 'DESC' },
        take: limit,
      });
    } else {
      logs = await this.logRepo.find({
        order: { createdAt: 'DESC' },
        take: limit,
      });
    }

    return logs.map((log) => {
      const isActive = log.status === 'Active';
      return {
        event: log.event,
        asset: log.asset,
        status: log.status,
        statusClass: isActive
          ? 'text-secondary bg-secondary/10'
          : 'text-on-surface-variant bg-surface-variant',
        revenue: log.revenue,
        time: this.timeAgo(log.createdAt),
      };
    });
  }

  private timeAgo(date: Date): string {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} mins ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
}
