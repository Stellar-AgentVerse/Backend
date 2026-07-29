import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  DeliveryCommandEntity,
  DeliveryOutboxEntity,
  DeliveryResultEntity,
  DeliveryState,
  Purchase,
  PurchaseStatus,
} from '../database/entities';
import {
  createDeliveryCommand,
  DeliveryCommand,
  VerifiedPurchaseEvent,
} from './delivery-command';

@Injectable()
export class PromptDeliveryService {
  constructor(
    @InjectRepository(DeliveryCommandEntity)
    private readonly commands: Repository<DeliveryCommandEntity>,
    @InjectRepository(DeliveryResultEntity)
    private readonly results: Repository<DeliveryResultEntity>,
    @InjectRepository(Purchase)
    private readonly purchases: Repository<Purchase>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async acceptVerifiedEvent(
    event: VerifiedPurchaseEvent,
  ): Promise<{ canonicalId: string; state: DeliveryState }> {
    const command = createDeliveryCommand(event);
    const configuredNetwork = this.config.get<string>('stellar.network');
    const configuredContract = this.config.get<string>(
      'stellar.contracts.purchaseContractId',
    );
    if (configuredNetwork && command.network !== configuredNetwork)
      throw new BadRequestException('Unsupported delivery network');
    if (configuredContract && command.contractId !== configuredContract)
      throw new BadRequestException('Unsupported delivery contract');
    if (new Date(command.expiresAt).getTime() <= Date.now())
      throw new BadRequestException('Delivery command expired');

    const purchase = await this.purchases.findOne({
      where: { id: command.purchaseId },
    });
    if (
      !purchase ||
      purchase.status !== PurchaseStatus.VERIFIED ||
      purchase.assetId !== command.assetId ||
      purchase.buyerPublicKey !== command.buyerPublicKey ||
      purchase.contractId !== command.contractId ||
      purchase.transactionHash !== command.transactionHash
    ) {
      throw new UnauthorizedException('Purchase event is not authorized');
    }
    const existing = await this.commands.findOne({
      where: { canonicalId: command.canonicalId },
    });
    if (existing)
      return { canonicalId: existing.canonicalId, state: existing.state };
    const entity = this.commands.create({
      ...command,
      id: undefined,
      expiresAt: new Date(command.expiresAt),
      state: DeliveryState.AUTHORIZED,
      attempts: 0,
      leaseUntil: null,
      nextAttemptAt: new Date(),
      failureCode: null,
    });
    try {
      await this.dataSource.transaction(async (manager) => {
        const saved = await manager
          .getRepository(DeliveryCommandEntity)
          .save(entity);
        await manager
          .getRepository(DeliveryOutboxEntity)
          .insert({
            commandId: saved.id,
            canonicalId: command.canonicalId,
            attempts: 0,
            publishedAt: null,
            availableAt: new Date(),
          });
      });
    } catch (error: any) {
      if (error?.code !== '23505') throw error;
    }
    const saved = await this.commands.findOneByOrFail({
      canonicalId: command.canonicalId,
    });
    return { canonicalId: saved.canonicalId, state: saved.state };
  }

  async getResult(
    purchaseId: string,
    buyerPublicKey: string,
  ): Promise<DeliveryResultEntity> {
    const result = await this.results.findOne({
      where: { purchaseId, buyerPublicKey },
    });
    if (!result) throw new NotFoundException('Delivery result not found');
    if (result.expiresAt.getTime() <= Date.now())
      throw new NotFoundException('Delivery result expired');
    return result;
  }
}

export function entityToCommand(
  entity: DeliveryCommandEntity,
): DeliveryCommand {
  return {
    version: entity.version,
    network: entity.network,
    contractId: entity.contractId,
    transactionHash: entity.transactionHash,
    ledgerSequence: Number(entity.ledgerSequence),
    eventIndex: entity.eventIndex,
    purchaseId: entity.purchaseId,
    assetId: entity.assetId,
    buyerPublicKey: entity.buyerPublicKey,
    tenantId: entity.tenantId,
    providerName: entity.providerName,
    expiresAt: entity.expiresAt.toISOString(),
    wrappedDek: entity.wrappedDek,
    encryptedPrompt: entity.encryptedPrompt,
    canonicalId: entity.canonicalId,
    canonicalJson: entity.canonicalJson,
  };
}
