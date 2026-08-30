import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Asset,
  AssetType,
  MAX_ATOMIC_PRICE,
  PromptPublication,
  PromptPublicationState,
} from '../../database/entities';
import { AppEnv } from '../../config/env.schema';
import { assertTransition } from './prompt-publication.state-machine';

const ATOMIC_PRICE_PATTERN = /^[1-9][0-9]{0,38}$/;
const COMMITMENT_PATTERN = /^[0-9a-f]{64}$/;
const CONTRACT_ID_PATTERN = /^C[A-Z2-7]{55}$/;
const TRANSACTION_HASH_PATTERN = /^[0-9a-f]{64}$/;
const LEDGER_SEQUENCE_PATTERN = /^[1-9][0-9]{0,18}$/;

export interface PublicationEvidence {
  commitment: string;
  contractId: string;
  transactionHash: string;
  ledgerSequence: string;
}

type PublicationPatch = Partial<
  Pick<
    PromptPublication,
    | 'commitment'
    | 'commitmentVersion'
    | 'priceAtomic'
    | 'contractId'
    | 'transactionHash'
    | 'ledgerSequence'
    | 'submittedAt'
    | 'reviewerPublicKey'
    | 'reviewedAt'
    | 'publishedAt'
    | 'failureCode'
    | 'failureDetail'
  >
>;

@Injectable()
export class PromptPublicationService {
  private readonly logger = new Logger(PromptPublicationService.name);

  constructor(
    @InjectRepository(PromptPublication)
    private readonly publicationRepo: Repository<PromptPublication>,
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    private readonly configService: ConfigService<AppEnv>,
  ) {}

  /**
   * Open a draft publication for a PROMPT asset owned by the caller.
   * The atomic-unit price is bound here and never changes afterwards.
   */
  async create(
    assetId: string,
    creatorPublicKey: string,
    priceAtomic: string,
  ): Promise<PromptPublication> {
    const asset = await this.assetRepo.findOne({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }
    if (asset.creatorPublicKey !== creatorPublicKey) {
      throw new ForbiddenException('Only the asset creator can publish it');
    }
    if (asset.type !== AssetType.PROMPT) {
      throw new BadRequestException(
        'Curated publication is limited to PROMPT assets',
      );
    }

    this.assertAtomicPrice(priceAtomic);

    const existing = await this.publicationRepo.findOne({ where: { assetId } });
    if (existing) {
      throw new ConflictException(
        `Asset ${assetId} already has a publication record`,
      );
    }

    const publication = this.publicationRepo.create({
      assetId,
      priceAtomic,
      state: PromptPublicationState.DRAFT,
      network: this.network(),
    });

    const saved = await this.publicationRepo.save(publication);
    this.logger.log(`Publication ${saved.id} opened in DRAFT`);
    return saved;
  }

  /** Creator hands the draft to the review queue. */
  async submit(
    assetId: string,
    creatorPublicKey: string,
  ): Promise<PromptPublication> {
    const publication = await this.requireForCreator(assetId, creatorPublicKey);
    return this.transition(publication, PromptPublicationState.PENDING_REVIEW, {
      submittedAt: new Date(),
    });
  }

  /**
   * Operator decision. Approving moves the row into `PUBLISHING`, which is the
   * seam the Testnet registration work unit picks up. Rejecting returns it to
   * the creator as a draft.
   */
  async review(
    assetId: string,
    reviewerPublicKey: string,
    approve: boolean,
    reason?: string,
  ): Promise<PromptPublication> {
    const publication = await this.require(assetId);
    const target = approve
      ? PromptPublicationState.PUBLISHING
      : PromptPublicationState.DRAFT;

    return this.transition(publication, target, {
      reviewerPublicKey,
      reviewedAt: new Date(),
      failureCode: approve ? null : 'REVIEW_REJECTED',
      failureDetail: approve ? null : (reason ?? null),
    });
  }

  /**
   * Record an authoritative on-chain registration.
   *
   * Not reachable over HTTP in this work unit — the Testnet registration unit
   * calls it after `register_private_prompt` succeeds. The evidence is required
   * in full: the database `CHECK` rejects a `PUBLISHED` row without it, and
   * failing here keeps the error legible instead of surfacing as a constraint
   * violation.
   */
  async markPublished(
    assetId: string,
    evidence: PublicationEvidence,
  ): Promise<PromptPublication> {
    const publication = await this.require(assetId);
    this.assertEvidence(evidence);

    return this.transition(publication, PromptPublicationState.PUBLISHED, {
      commitment: evidence.commitment,
      contractId: evidence.contractId,
      transactionHash: evidence.transactionHash,
      ledgerSequence: evidence.ledgerSequence,
      publishedAt: new Date(),
      failureCode: null,
      failureDetail: null,
    });
  }

  /** Record a failed registration attempt so an operator can retry it. */
  async markFailed(
    assetId: string,
    failureCode: string,
    failureDetail?: string,
  ): Promise<PromptPublication> {
    const publication = await this.require(assetId);
    assertTransition(publication.state, PromptPublicationState.FAILED);

    const result = await this.publicationRepo
      .createQueryBuilder()
      .update(PromptPublication)
      .set({
        state: PromptPublicationState.FAILED,
        failureCode,
        failureDetail: failureDetail ?? null,
        attempts: () => '"attempts" + 1',
      })
      .where('id = :id AND state = :from', {
        id: publication.id,
        from: publication.state,
      })
      .execute();

    this.assertApplied(result.affected);
    this.logger.warn(
      `Publication ${publication.id} failed: ${failureCode} (${publication.state} -> FAILED)`,
    );
    return this.require(assetId);
  }

  /** Read for the creator or an operator. Never returns prompt content. */
  async findForActor(
    assetId: string,
    actorPublicKey: string,
    isOperator: boolean,
  ): Promise<PromptPublication> {
    const publication = await this.require(assetId);
    if (isOperator) {
      return publication;
    }

    const asset = await this.assetRepo.findOne({ where: { id: assetId } });
    if (!asset || asset.creatorPublicKey !== actorPublicKey) {
      throw new ForbiddenException('Not allowed to read this publication');
    }
    return publication;
  }

  // --- internal helpers ---

  /**
   * Every transition is a conditional UPDATE guarded by the state it was read
   * in. Two concurrent approvals cannot both advance the row: the second one
   * matches zero rows and is rejected instead of silently overwriting.
   */
  private async transition(
    publication: PromptPublication,
    to: PromptPublicationState,
    patch: PublicationPatch,
  ): Promise<PromptPublication> {
    assertTransition(publication.state, to);
    this.assertBindingWritable(publication, patch);

    const result = await this.publicationRepo
      .createQueryBuilder()
      .update(PromptPublication)
      .set({ ...patch, state: to })
      .where('id = :id AND state = :from', {
        id: publication.id,
        from: publication.state,
      })
      .execute();

    this.assertApplied(result.affected);
    this.logger.log(
      `Publication ${publication.id}: ${publication.state} -> ${to}`,
    );
    return this.require(publication.assetId);
  }

  private assertApplied(affected: number | null | undefined): void {
    if (affected !== 1) {
      throw new ConflictException('Publication state changed concurrently');
    }
  }

  /**
   * Write-once binding. `priceAtomic` and `commitmentVersion` are fixed at
   * creation; `commitment` may be written once while it is still null. A retry
   * therefore cannot rebind an already published prompt to a different price or
   * a different commitment.
   */
  private assertBindingWritable(
    current: PromptPublication,
    patch: PublicationPatch,
  ): void {
    const rebindsPrice =
      patch.priceAtomic !== undefined &&
      patch.priceAtomic !== current.priceAtomic;
    const rebindsVersion =
      patch.commitmentVersion !== undefined &&
      patch.commitmentVersion !== current.commitmentVersion;
    const rebindsCommitment =
      patch.commitment !== undefined &&
      current.commitment !== null &&
      patch.commitment !== current.commitment;

    if (rebindsPrice || rebindsVersion || rebindsCommitment) {
      throw new ConflictException('Publication binding is immutable');
    }
  }

  private assertAtomicPrice(priceAtomic: string): void {
    if (
      typeof priceAtomic !== 'string' ||
      !ATOMIC_PRICE_PATTERN.test(priceAtomic)
    ) {
      throw new BadRequestException(
        'priceAtomic must be a positive integer in atomic units',
      );
    }
    if (BigInt(priceAtomic) > MAX_ATOMIC_PRICE) {
      throw new BadRequestException('priceAtomic exceeds the i128 range');
    }
  }

  private assertEvidence(evidence: PublicationEvidence): void {
    const failures: string[] = [];
    if (!COMMITMENT_PATTERN.test(evidence?.commitment ?? '')) {
      failures.push('commitment');
    }
    if (!CONTRACT_ID_PATTERN.test(evidence?.contractId ?? '')) {
      failures.push('contractId');
    }
    if (!TRANSACTION_HASH_PATTERN.test(evidence?.transactionHash ?? '')) {
      failures.push('transactionHash');
    }
    if (!LEDGER_SEQUENCE_PATTERN.test(evidence?.ledgerSequence ?? '')) {
      failures.push('ledgerSequence');
    }
    if (failures.length > 0) {
      throw new BadRequestException(
        `Invalid on-chain evidence: ${failures.join(', ')}`,
      );
    }
  }

  private async require(assetId: string): Promise<PromptPublication> {
    const publication = await this.publicationRepo.findOne({
      where: { assetId },
    });
    if (!publication) {
      throw new NotFoundException(`No publication for asset ${assetId}`);
    }
    return publication;
  }

  private async requireForCreator(
    assetId: string,
    creatorPublicKey: string,
  ): Promise<PromptPublication> {
    const asset = await this.assetRepo.findOne({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }
    if (asset.creatorPublicKey !== creatorPublicKey) {
      throw new ForbiddenException('Only the asset creator can publish it');
    }
    return this.require(assetId);
  }

  private network(): string {
    return (
      this.configService.get('stellar.network', { infer: true }) ?? 'testnet'
    );
  }
}
