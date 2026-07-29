import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DeliveryCommandEntity,
  DeliveryOutboxEntity,
  DeliveryResultEntity,
  DeliveryState,
} from '../database/entities';
import { AiProviderService, ProviderError } from './ai-provider.service';
import {
  EnvelopeCryptoService,
  EncryptedEnvelope,
} from './envelope-crypto.service';
import { KeyManagerService } from './key-manager.service';
import { entityToCommand } from './prompt-delivery.service';

const LEASE_MS = 60_000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class PromptDeliveryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PromptDeliveryWorker.name);
  private timer: NodeJS.Timeout | undefined;
  constructor(
    @InjectRepository(DeliveryCommandEntity)
    private readonly commands: Repository<DeliveryCommandEntity>,
    @InjectRepository(DeliveryResultEntity)
    private readonly results: Repository<DeliveryResultEntity>,
    @InjectRepository(DeliveryOutboxEntity)
    private readonly outbox: Repository<DeliveryOutboxEntity>,
    private readonly keyManager: KeyManagerService,
    private readonly crypto: EnvelopeCryptoService,
    private readonly providers: AiProviderService,
  ) {}

  onModuleInit(): void {
    if (process.env.PROMPT_DELIVERY_WORKER_ENABLED !== 'true') return;
    this.timer = setInterval(() => void this.processOnce(), 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async processOnce(workerId = `worker-${process.pid}`): Promise<boolean> {
    const now = new Date();
    const candidate = await this.commands
      .createQueryBuilder('command')
      .where(
        '(command.state IN (:...ready) AND (command."nextAttemptAt" IS NULL OR command."nextAttemptAt" <= :now)) OR (command.state = :processing AND command."leaseUntil" < :now)',
        {
          ready: [DeliveryState.AUTHORIZED, DeliveryState.RETRYABLE_FAILURE],
          now,
          processing: DeliveryState.PROCESSING,
        },
      )
      .orderBy('command."createdAt"', 'ASC')
      .getOne();
    if (!candidate) return false;
    const claimed = await this.commands
      .createQueryBuilder()
      .update(DeliveryCommandEntity)
      .set({
        state: DeliveryState.PROCESSING,
        leaseUntil: new Date(Date.now() + LEASE_MS),
        attempts: () => '"attempts" + 1',
      })
      .where(
        'id = :id AND (state IN (:...ready) OR (state = :processing AND "leaseUntil" < :now))',
        {
          id: candidate.id,
          ready: [DeliveryState.AUTHORIZED, DeliveryState.RETRYABLE_FAILURE],
          processing: DeliveryState.PROCESSING,
          now,
        },
      )
      .returning('*')
      .execute();
    if (!claimed.raw.length) return false;
    const command = claimed.raw[0] as DeliveryCommandEntity;
    await this.outbox
      .createQueryBuilder()
      .update(DeliveryOutboxEntity)
      .set({ publishedAt: new Date(), attempts: () => '"attempts" + 1' })
      .where('"commandId" = :commandId AND "publishedAt" IS NULL', {
        commandId: command.id,
      })
      .execute();
    try {
      await this.execute(command);
      return true;
    } catch (error: any) {
      const retryable =
        error instanceof ProviderError
          ? error.retryable
          : error?.message === 'KMS decrypt failed' ||
            error?.message === 'KMS encrypt failed';
      const attempts = Number(command.attempts);
      const state =
        retryable && attempts < MAX_ATTEMPTS
          ? DeliveryState.RETRYABLE_FAILURE
          : retryable
            ? DeliveryState.DEAD_LETTERED
            : DeliveryState.TERMINAL_FAILURE;
      await this.commands.update(command.id, {
        state,
        leaseUntil: null,
        nextAttemptAt:
          state === DeliveryState.RETRYABLE_FAILURE
            ? new Date(Date.now() + Math.min(300_000, 2 ** attempts * 1000))
            : null,
        failureCode: error?.code ?? 'DELIVERY_FAILED',
      });
      this.logger.warn('Delivery attempt failed', {
        commandId: command.canonicalId,
        state,
      });
      return false;
    }
  }

  private async execute(entity: DeliveryCommandEntity): Promise<void> {
    const command = entityToCommand(entity);
    if (new Date(command.expiresAt).getTime() <= Date.now()) {
      await this.commands.update(entity.id, {
        state: DeliveryState.EXPIRED,
        leaseUntil: null,
      });
      return;
    }
    const existingResult = await this.results.findOne({
      where: { canonicalId: command.canonicalId },
    });
    if (existingResult) {
      await this.commands.update(entity.id, {
        state: DeliveryState.SUCCEEDED,
        leaseUntil: null,
        nextAttemptAt: null,
      });
      return;
    }
    let key: Buffer | null = null;
    let prompt: Buffer | null = null;
    let response: Buffer | null = null;
    try {
      key = await this.keyManager.getDecryptionKey(
        command.tenantId,
        command.wrappedDek,
        {
          canonicalId: command.canonicalId,
          buyer: command.buyerPublicKey,
          purchaseId: command.purchaseId,
        },
      );
      const envelope = JSON.parse(
        Buffer.from(command.encryptedPrompt, 'base64url').toString('utf8'),
      ) as EncryptedEnvelope;
      prompt = this.crypto.decrypt(envelope, key, command);
      const providerResult = await this.providers.execute(
        command.providerName,
        { prompt, idempotencyKey: command.canonicalId, timeoutMs: 30_000 },
      );
      response = providerResult.response;
      const encryptedResult = this.crypto.encrypt(response, key, command, true);
      await this.results.insert(
        this.results.create({
          canonicalId: command.canonicalId,
          commandId: entity.id,
          purchaseId: command.purchaseId,
          buyerPublicKey: command.buyerPublicKey,
          tenantId: command.tenantId,
          encryptedResult: encryptedResult as any,
          expiresAt: new Date(command.expiresAt),
        }),
      );
      await this.commands.update(entity.id, {
        state: DeliveryState.SUCCEEDED,
        leaseUntil: null,
        nextAttemptAt: null,
      });
    } finally {
      if (key) this.keyManager.zeroKey(key);
      if (prompt) prompt.fill(0);
      if (response) response.fill(0);
    }
  }
}
