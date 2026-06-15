import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Asset,
  AssetMetric,
  AssetCapability,
  AssetWorkflowStep,
  AssetSpec,
  Tag,
} from '../database/entities';
import { CreateAssetDto } from './dto/create-asset.dto';
import { AssetResponseDto } from './dto/asset-response.dto';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    @InjectRepository(AssetMetric)
    private readonly metricRepo: Repository<AssetMetric>,
    @InjectRepository(AssetCapability)
    private readonly capabilityRepo: Repository<AssetCapability>,
    @InjectRepository(AssetWorkflowStep)
    private readonly workflowRepo: Repository<AssetWorkflowStep>,
    @InjectRepository(AssetSpec)
    private readonly specRepo: Repository<AssetSpec>,
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,
  ) {}

  async create(dto: CreateAssetDto, creatorPublicKey: string): Promise<AssetResponseDto> {
    const baseSlug = slugify(dto.name);
    let slug = baseSlug;
    let counter = 1;
    while (await this.assetRepo.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const asset = this.assetRepo.create({
      name: dto.name,
      slug,
      description: dto.description ?? '',
      type: dto.type,
      creatorPublicKey,
      price: dto.price ?? 0,
      tags: dto.tags ?? [],
    });

    const saved = await this.assetRepo.save(asset);
    this.logger.log(`Asset created: ${saved.id} — ${saved.name}`);

    // Seed default metric
    await this.metricRepo.save(
      this.metricRepo.create({ assetId: saved.id }),
    );

    return this.toDetailDto(saved);
  }

  async findById(id: string): Promise<AssetResponseDto> {
    const asset = await this.assetRepo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException(`Asset ${id} not found`);

    const dto = await this.toDetailDto(asset);
    dto.metrics = await this.getMetrics(id);
    dto.capabilities = await this.getCapabilities(id);
    dto.workflow = await this.getWorkflow(id);
    dto.specs = await this.getSpecs(id);
    return dto;
  }

  async findPublished(skip = 0, take = 20): Promise<{ items: AssetResponseDto[]; total: number }> {
    const [assets, total] = await this.assetRepo.findAndCount({
      where: { status: 'PUBLISHED' as any },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
    const items = await Promise.all(assets.map((a) => this.toDetailDto(a)));
    return { items, total };
  }

  async findByCreator(publicKey: string): Promise<AssetResponseDto[]> {
    const assets = await this.assetRepo.find({
      where: { creatorPublicKey: publicKey },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(assets.map((a) => this.toDetailDto(a)));
  }

  async getAssetTypes(): Promise<{ id: string; icon: string; title: string; description: string }[]> {
    return [
      { id: 'agent', icon: 'smart_toy', title: 'Agent', description: 'Autonomous logic entities powered by LLMs.' },
      { id: 'prompt', icon: 'terminal', title: 'Prompt', description: 'Optimized instructions and reasoning chains.' },
      { id: 'model', icon: 'memory', title: 'Model', description: 'Custom fine-tunes or specialized weights.' },
      { id: 'dataset', icon: 'database', title: 'Dataset', description: 'High-signal training corpora or vector stores.' },
      { id: 'tool', icon: 'build', title: 'Tool', description: 'Custom API connectors and function calls.' },
      { id: 'oracle', icon: 'radar', title: 'Oracle', description: 'Real-world data validation for smart agents.' },
    ];
  }

  async getTags(): Promise<Tag[]> {
    return this.tagRepo.find({ order: { name: 'ASC' } });
  }

  // --- internal helpers ---

  private async getMetrics(assetId: string) {
    const m = await this.metricRepo.findOne({ where: { assetId } });
    if (!m) return undefined;
    return {
      executions: Number(m.executions),
      revenue: Number(m.revenue),
      activeUsers: m.activeUsers,
      rating: Number(m.rating),
      reliability: Number(m.reliability),
    };
  }

  private async getCapabilities(assetId: string) {
    const rows = await this.capabilityRepo.find({
      where: { assetId },
      order: { sortOrder: 'ASC' },
    });
    return rows.map((r) => ({
      icon: r.icon,
      title: r.title,
      description: r.description,
      sortOrder: r.sortOrder,
    }));
  }

  private async getWorkflow(assetId: string) {
    const rows = await this.workflowRepo.find({
      where: { assetId },
      order: { stepOrder: 'ASC' },
    });
    return rows.map((r) => ({
      stepOrder: r.stepOrder,
      icon: r.icon,
      label: r.label,
      isActive: r.isActive,
      isFilled: r.isFilled,
    }));
  }

  private async getSpecs(assetId: string) {
    const rows = await this.specRepo.find({
      where: { assetId },
      order: { sortOrder: 'ASC' },
    });
    return rows.map((r) => ({
      parameter: r.parameter,
      value: r.value,
      notes: r.notes,
      sortOrder: r.sortOrder,
    }));
  }

  private async toDetailDto(asset: Asset): Promise<AssetResponseDto> {
    return {
      id: asset.id,
      name: asset.name,
      slug: asset.slug,
      description: asset.description,
      type: asset.type,
      creatorPublicKey: asset.creatorPublicKey,
      price: Number(asset.price),
      status: asset.status,
      imageUrl: asset.imageUrl,
      tags: asset.tags,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  }
}
