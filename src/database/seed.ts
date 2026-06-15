import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  User,
  Asset,
  AssetMetric,
  AssetCapability,
  AssetWorkflowStep,
  AssetSpec,
  Wallet,
  CreditPackage,
  WalletTransaction,
  TransactionType,
  ActivityLog,
  Tag,
  AssetType,
} from './entities';

export async function seedDatabase(dataSource: DataSource): Promise<void> {
  const logger = new Logger('Seed');

  if ('isInitialized' in dataSource && !dataSource.isInitialized) {
    logger.warn('DataSource is not initialized, skipping seed.');
    return;
  }

  // Only seed if no credit packages exist
  const pkgRepo = dataSource.getRepository(CreditPackage);
  const existing = await pkgRepo.count();
  if (existing > 0) {
    logger.log('Database already seeded, skipping.');
    return;
  }

  logger.log('Seeding database...');

  // --- Tags ---
  const tagRepo = dataSource.getRepository(Tag);
  await tagRepo.save([
    { name: 'beta', slug: 'beta' },
    { name: 'stable', slug: 'stable' },
    { name: 'experimental', slug: 'experimental' },
    { name: 'deprecated', slug: 'deprecated' },
    { name: 'featured', slug: 'featured' },
  ]);

  // --- Credit Packages ---
  await pkgRepo.save([
    {
      name: 'Starter',
      slug: 'starter',
      description: 'Perfect for individual developers and testing.',
      icon: 'rocket_launch',
      credits: 500,
      price: 50,
      originalPrice: null,
      features: ['Standard Execution Speed', 'Basic Agent Monitoring'],
      popular: false,
      sortOrder: 1,
    },
    {
      name: 'Pro',
      slug: 'pro',
      description: 'For growing agents that need consistent power.',
      icon: 'workspace_premium',
      credits: 2500,
      price: 200,
      originalPrice: 250,
      features: ['Priority Execution', 'Advanced Analytics Suite', 'API Sandbox Access'],
      popular: true,
      sortOrder: 2,
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      description: 'Massive scale for high-volume workflows.',
      icon: 'corporate_fare',
      credits: 10000,
      price: 800,
      originalPrice: null,
      features: ['Ultra-low Latency Node', 'Unlimited Agent Deployments', '24/7 Priority Support'],
      popular: false,
      sortOrder: 3,
    },
  ]);

  // --- Sample Assets ---
  const assetRepo = dataSource.getRepository(Asset);
  const metricRepo = dataSource.getRepository(AssetMetric);
  const capabilityRepo = dataSource.getRepository(AssetCapability);
  const workflowRepo = dataSource.getRepository(AssetWorkflowStep);
  const specRepo = dataSource.getRepository(AssetSpec);

  const creatorPk = 'GD3WU7K2VZPV4J7K6Z7VZPV4J7K6Z7VZPV4J7K6Z7VZ';

  const assets = await assetRepo.save([
    {
      name: 'CyberOracle-v2', slug: 'cyberoracle-v2', description: 'Advanced prediction agent with real-time market analysis.',
      type: AssetType.AGENT, creatorPublicKey: creatorPk, price: 25, tags: ['featured', 'stable'],
    },
    {
      name: 'QuantNexus', slug: 'quantnexus', description: 'High-frequency trading agent with ML-driven strategy optimization.',
      type: AssetType.AGENT, creatorPublicKey: creatorPk, price: 50, tags: ['stable'],
    },
    {
      name: 'MetaScout-X', slug: 'metascout-x', description: 'Autonomous web research agent with cross-source verification.',
      type: AssetType.AGENT, creatorPublicKey: creatorPk, price: 15, tags: ['beta', 'featured'],
    },
    {
      name: 'CodeArchitect v2', slug: 'codearchitect-v2', description: 'AI pair programmer with multi-language support.',
      type: AssetType.AGENT, creatorPublicKey: creatorPk, price: 320, tags: ['stable'],
    },
    {
      name: 'LegalScryer Data', slug: 'legalscryer-data', description: 'Comprehensive legal document analysis dataset.',
      type: AssetType.DATASET, creatorPublicKey: creatorPk, price: 1800, tags: ['featured'],
    },
    {
      name: 'Visionary Prompt', slug: 'visionary-prompt', description: 'Optimized prompt chains for image generation models.',
      type: AssetType.PROMPT, creatorPublicKey: creatorPk, price: 85, tags: ['beta'],
    },
    {
      name: 'Salesforce Automata', slug: 'salesforce-automata', description: 'Automated CRM workflow with lead scoring.',
      type: AssetType.TOOL, creatorPublicKey: creatorPk, price: 560, tags: ['stable', 'featured'],
    },
    {
      name: 'MarketPulse AI', slug: 'marketpulse-ai', description: 'Real-time market sentiment analysis agent.',
      type: AssetType.AGENT, creatorPublicKey: creatorPk, price: 30, tags: ['featured'],
    },
    {
      name: 'OmniVision Agent', slug: 'omnivision-agent', description: 'Multi-modal perception agent for visual data.',
      type: AssetType.AGENT, creatorPublicKey: creatorPk, price: 45, tags: ['stable'],
    },
    {
      name: 'Nova-7 Strategist', slug: 'nova-7-strategist', description: 'Strategic planning agent with predictive modeling.',
      type: AssetType.AGENT, creatorPublicKey: creatorPk, price: 25, tags: ['featured'],
    },
    {
      name: 'Aura-7 Research Intel', slug: 'aura-7-research-intel', description: 'Advanced autonomous agent specialized in cross-domain market synthesis and predictive trend modeling.',
      type: AssetType.AGENT, creatorPublicKey: creatorPk, price: 15, tags: ['featured', 'stable'],
    },
    {
      name: 'EcoTrend Ledger', slug: 'ecotrend-ledger', description: 'Environmental impact tracking dataset with global coverage.',
      type: AssetType.DATASET, creatorPublicKey: creatorPk, price: 12, tags: ['stable'],
    },
  ]);

  // --- Metrics for each asset ---
  await metricRepo.save(
    assets.map((a, i) => ({
      assetId: a.id,
      executions: Math.floor(Math.random() * 5000) + 500,
      revenue: parseFloat((Math.random() * 50000 + 1000).toFixed(2)),
      activeUsers: Math.floor(Math.random() * 900) + 50,
      rating: parseFloat((3.5 + Math.random() * 1.5).toFixed(2)),
      reliability: parseFloat((95 + Math.random() * 5).toFixed(2)),
    })),
  );

  // --- Capabilities for first asset (Aura-7) ---
  const auraAsset = assets.find((a) => a.slug === 'aura-7-research-intel');
  if (auraAsset) {
    await capabilityRepo.save([
      {
        assetId: auraAsset.id, icon: 'search_insights', title: 'Deep Research',
        description: 'Autonomous multi-source extraction across global financial indices, scientific journals, and social sentiment feeds with real-time verification layers.',
        sortOrder: 1,
      },
      {
        assetId: auraAsset.id, icon: 'model_training', title: 'Semantic Synthesis',
        description: 'Advanced LLM-driven logic to connect disparate data points into cohesive strategic reports with executable insights and probability mapping.',
        sortOrder: 2,
      },
    ]);

    await workflowRepo.save([
      { assetId: auraAsset.id, stepOrder: 1, icon: 'input', label: 'Input Query', isActive: true, isFilled: false },
      { assetId: auraAsset.id, stepOrder: 2, icon: 'hub', label: 'Neural Analysis', isActive: false, isFilled: false },
      { assetId: auraAsset.id, stepOrder: 3, icon: 'article', label: 'Strategic Intel', isActive: true, isFilled: true },
    ]);

    await specRepo.save([
      { assetId: auraAsset.id, parameter: 'Model Architecture', value: 'Aether-Core-v7.2', notes: 'Proprietary logic gate optimization', sortOrder: 1 },
      { assetId: auraAsset.id, parameter: 'Max Context Window', value: '128k tokens', notes: 'Optimized for long-form synthesis', sortOrder: 2 },
      { assetId: auraAsset.id, parameter: 'Data Refresh Rate', value: 'Real-time', notes: 'Websocket stream integration', sortOrder: 3 },
      { assetId: auraAsset.id, parameter: 'Output Formats', value: 'XML, JSON, Markdown', notes: 'Standardized Aetheric logic schemas', sortOrder: 4 },
    ]);
  }

  // --- Activity Logs ---
  const logRepo = dataSource.getRepository(ActivityLog);
  const now = Date.now();
  await logRepo.save([
    { event: 'Execution Success', asset: 'CYBERORACLE-V2', status: 'Active', revenue: '+0.25 XLM', userPublicKey: creatorPk, createdAt: new Date(now - 2 * 60000) },
    { event: 'New Subscription', asset: 'QUANTNEXUS', status: 'Active', revenue: '+500.00 XLM', userPublicKey: creatorPk, createdAt: new Date(now - 14 * 60000) },
    { event: 'API Heartbeat', asset: 'METASCOUT-X', status: 'Idle', revenue: '--', userPublicKey: creatorPk, createdAt: new Date(now - 60 * 60000) },
    { event: 'Deployment Success', asset: 'NOVA-7-STRATEGIST', status: 'Active', revenue: '+12.50 XLM', userPublicKey: creatorPk, createdAt: new Date(now - 90 * 60000) },
    { event: 'Model Update', asset: 'AURA-7-RESEARCH-INTEL', status: 'Active', revenue: '--', userPublicKey: creatorPk, createdAt: new Date(now - 120 * 60000) },
  ]);

  // --- Wallet for creator ---
  const walletRepo = dataSource.getRepository(Wallet);
  const wallet = await walletRepo.save({
    userPublicKey: creatorPk,
    credits: 450,
    xlmBalance: 1240.45,
    monthlyUsage: 67,
    monthlyAllocation: 100,
  });

  // --- Transactions ---
  const txRepo = dataSource.getRepository(WalletTransaction);
  await txRepo.save([
    { walletId: wallet.id, type: TransactionType.PURCHASE, description: 'Marketplace: Data Aggregator V2', txid: '0x82f...e31', amount: -120, createdAt: new Date('2023-10-24') },
    { walletId: wallet.id, type: TransactionType.INCOME, description: 'Agent Revenue: Neural-Search-Bot', txid: '0x41a...b2c', amount: 45.50, createdAt: new Date('2023-10-23') },
    { walletId: wallet.id, type: TransactionType.FEE, description: 'Network Maintenance Fee', txid: '0x111...789', amount: -0.50, createdAt: new Date('2023-10-22') },
    { walletId: wallet.id, type: TransactionType.REFILL, description: 'Resource Refill: Starter Pack', txid: '0x902...a4e', amount: 500, createdAt: new Date('2023-10-20') },
  ]);

  logger.log(`Database seeded with ${assets.length} assets, tags, packages, and sample data.`);
}
