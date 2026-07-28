import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  BadRequestException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { sorobanConfig } from '../tokens/config/soroban.config';
import { Asset, AssetType } from '../database/entities';
import { Purchase, PurchaseStatus } from '../database/entities/purchase.entity';
import { PurchaseIntentDto } from './dto/purchase-intent.dto';
import { PurchaseAccessDto } from './dto/purchase-access.dto';

@Injectable()
export class PurchasesService implements OnModuleInit {
  private readonly logger = new Logger(PurchasesService.name);

  private readonly MOCK_MODE: boolean;

  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepo: Repository<Purchase>,
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    @Inject(sorobanConfig.KEY)
    private readonly sorobanConfig: {
      network: string;
      rpcUrl: string;
      networkPassphrase: string;
      contracts: {
        tokenMint: string;
        tokenSale: string;
        purchaseContractId: string;
      };
      adminSecretKey: string;
    },
  ) {
    this.MOCK_MODE =
      process.env.NODE_ENV === 'test' &&
      (!this.sorobanConfig.contracts.purchaseContractId ||
        this.sorobanConfig.contracts.purchaseContractId.includes('PLACEHOLDER'));
  }

  onModuleInit() {
    if (this.MOCK_MODE) {
      this.logger.warn(
        'SOROBAN_MARKETPLACE_CONTRACT_ID not configured — running in mock mode. Purchases will not be verified on Testnet.',
      );
    } else {
      this.logger.log(
        `Marketplace contract: ${this.sorobanConfig.contracts.purchaseContractId}`,
      );
    }
  }

  async createIntent(
    assetId: string,
    buyerPublicKey: string,
    idempotencyKey?: string,
  ): Promise<PurchaseIntentDto> {
    const asset = await this.assetRepo.findOne({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }
    if (asset.status !== 'PUBLISHED') {
      throw new BadRequestException(`Asset ${assetId} is not published`);
    }
    if (asset.type !== AssetType.PROMPT) {
      throw new BadRequestException(
        `Purchase is only supported for PROMPT assets at this time`,
      );
    }

    const key = idempotencyKey ?? randomUUID();
    const existing = await this.purchaseRepo.findOne({
      where: { idempotencyKey: key },
    });
    if (existing) {
      if (existing.status === PurchaseStatus.VERIFIED) {
        throw new ConflictException('Purchase already completed');
      }
      return this.toIntentDto(existing);
    }

    const amount = Number(asset.price);
    const contractId = this.sorobanConfig.contracts.purchaseContractId || 'MOCK_CONTRACT';
    const networkPassphrase = this.sorobanConfig.networkPassphrase;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    const purchase = this.purchaseRepo.create({
      id: randomUUID(),
      assetId,
      buyerPublicKey,
      status: PurchaseStatus.PENDING,
      idempotencyKey: key,
      transactionHash: null,
      contractId,
      networkPassphrase,
      amount,
      expiresAt,
      confirmedAt: null,
    });

    const saved = await this.purchaseRepo.save(purchase);
    this.logger.log(`Purchase intent created: ${saved.id} for asset ${assetId} by ${buyerPublicKey}`);

    const unsignedXdr = await this.buildUnsignedXdr(
      buyerPublicKey,
      contractId,
      assetId,
      amount,
    );

    return {
      purchaseId: saved.id,
      unsignedXdr,
      expiresAt: saved.expiresAt,
      contractId: saved.contractId,
      networkPassphrase: saved.networkPassphrase,
      assetId: saved.assetId,
      amount: saved.amount,
      idempotencyKey: saved.idempotencyKey,
    };
  }

  async confirm(
    purchaseId: string,
    transactionHash: string,
    buyerPublicKey: string,
  ): Promise<{ purchaseId: string; status: PurchaseStatus }> {
    const purchase = await this.purchaseRepo.findOne({
      where: { id: purchaseId },
    });
    if (!purchase) {
      throw new NotFoundException(`Purchase ${purchaseId} not found`);
    }
    if (purchase.status !== PurchaseStatus.PENDING) {
      throw new ConflictException(
        `Purchase is already ${purchase.status.toLowerCase()}`,
      );
    }
    if (purchase.buyerPublicKey !== buyerPublicKey) {
      throw new UnauthorizedException('Purchase does not belong to this user');
    }
    if (new Date() > purchase.expiresAt) {
      purchase.status = PurchaseStatus.EXPIRED;
      await this.purchaseRepo.save(purchase);
      throw new BadRequestException('Purchase intent has expired');
    }

    const duplicateHash = await this.purchaseRepo.findOne({
      where: { transactionHash },
    });
    if (duplicateHash) {
      throw new ConflictException('Transaction hash has already been used');
    }

    const isValid = await this.verifyTransaction(
      transactionHash,
      buyerPublicKey,
      purchase.contractId,
      purchase.assetId,
      purchase.amount,
      purchase.networkPassphrase,
    );
    if (!isValid) {
      purchase.status = PurchaseStatus.FAILED;
      purchase.transactionHash = transactionHash;
      await this.purchaseRepo.save(purchase);
      throw new BadRequestException('Transaction verification failed');
    }

    purchase.status = PurchaseStatus.VERIFIED;
    purchase.transactionHash = transactionHash;
    purchase.confirmedAt = new Date();
    await this.purchaseRepo.save(purchase);

    this.logger.log(
      `Purchase ${purchaseId} confirmed with tx ${transactionHash}`,
    );

    return { purchaseId: purchase.id, status: purchase.status };
  }

  async getAccess(
    purchaseId: string,
    requesterPublicKey: string,
  ): Promise<PurchaseAccessDto> {
    const purchase = await this.purchaseRepo.findOne({
      where: { id: purchaseId },
    });
    if (!purchase) {
      throw new NotFoundException(`Purchase ${purchaseId} not found`);
    }
    if (purchase.buyerPublicKey !== requesterPublicKey) {
      throw new UnauthorizedException('Access denied: not the purchase owner');
    }
    if (purchase.status !== PurchaseStatus.VERIFIED) {
      throw new BadRequestException(
        `Purchase is not verified (status: ${purchase.status.toLowerCase()})`,
      );
    }

    return {
      purchaseId: purchase.id,
      assetId: purchase.assetId,
      deliveryReference: `asset://${purchase.assetId}/purchase/${purchase.id}`,
      purchasedAt: purchase.confirmedAt!,
    };
  }

  private async buildUnsignedXdr(
    buyerPublicKey: string,
    contractId: string,
    assetId: string,
    amount: number,
  ): Promise<string> {
    if (this.MOCK_MODE) {
      return `AAAAAgAAAAB...mock-unsigned-xdr-for-purchase-${assetId.slice(0, 8)}...`;
    }

    const StellarSdk = await import('@stellar/stellar-sdk');
    const rpc = new StellarSdk.rpc.Server(this.sorobanConfig.rpcUrl);
    const account = await rpc.getAccount(buyerPublicKey);

    const contract = new StellarSdk.Contract(contractId);
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.sorobanConfig.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'purchase',
          StellarSdk.Address.fromString(buyerPublicKey).toScVal(),
          StellarSdk.nativeToScVal(assetId, { type: 'symbol' }),
          StellarSdk.nativeToScVal(BigInt(Math.round(amount * 100)), {
            type: 'i128',
          }),
        ),
      )
      .setTimeout(30)
      .build();

    const simResult = await rpc.simulateTransaction(tx);
    const assembled = StellarSdk.rpc.assembleTransaction(tx, simResult).build();
    return assembled.toEnvelope().toXDR('base64');
  }

  private async verifyTransaction(
    transactionHash: string,
    expectedBuyer: string,
    expectedContractId: string,
    expectedAssetId: string,
    expectedAmount: number,
    expectedNetworkPassphrase: string,
  ): Promise<boolean> {
    if (this.MOCK_MODE) {
      this.logger.log(
        `Mock verifying tx ${transactionHash} for buyer ${expectedBuyer}`,
      );
      return true;
    }

    try {
      const StellarSdk = await import('@stellar/stellar-sdk');
      const rpc = new StellarSdk.rpc.Server(this.sorobanConfig.rpcUrl);
      const txResponse = await rpc.getTransaction(transactionHash);

      if (txResponse.status !== 'SUCCESS') {
        this.logger.warn(
          `Transaction ${transactionHash} status: ${txResponse.status}`,
        );
        return false;
      }

      if (!txResponse.envelopeXdr) {
        this.logger.warn(`Transaction ${transactionHash} has no envelope XDR`);
        return false;
      }

      const tx = new StellarSdk.Transaction(
        txResponse.envelopeXdr,
        expectedNetworkPassphrase,
      );

      if (tx.source !== expectedBuyer) {
        this.logger.warn(
          `Transaction source ${tx.source} does not match expected buyer ${expectedBuyer}`,
        );
        return false;
      }

      const op = tx.operations[0];
      if (!op || (op as any).type !== 'invokeHostFunction') {
        this.logger.warn(`Transaction operation is not a contract invocation`);
        return false;
      }

      const invoke = (op as any).func?._value;
      if (!invoke || invoke.functionName?.toString() !== 'purchase') {
        this.logger.warn(`Transaction does not invoke the purchase entrypoint`);
        return false;
      }

      const StellarSdkAny = StellarSdk as any;
      const expectedContract = Buffer.from(
        StellarSdkAny.StrKey.decodeContract(expectedContractId),
      );
      const actualContract = Buffer.from(invoke.contractAddress.contractId());
      if (!actualContract.equals(expectedContract)) {
        this.logger.warn(`Transaction contract does not match purchase intent`);
        return false;
      }

      const args = invoke.args ?? [];
      if (args.length < 3) {
        this.logger.warn(`Purchase invocation has insufficient arguments`);
        return false;
      }

      const actualBuyer = StellarSdkAny.scValToNative(args[0]);
      const actualAssetId = StellarSdkAny.scValToNative(args[1]);
      const actualAmount = StellarSdkAny.scValToNative(args[2]);
      if (
        actualBuyer !== expectedBuyer ||
        actualAssetId !== expectedAssetId ||
        BigInt(actualAmount) !== BigInt(Math.round(expectedAmount * 100))
      ) {
        this.logger.warn(`Transaction arguments do not match purchase intent`);
        return false;
      }

      return true;
    } catch (err) {
      this.logger.error(
        `Transaction verification failed: ${(err as Error).message}`,
      );
      return false;
    }
  }

  private toIntentDto(purchase: Purchase): PurchaseIntentDto {
    return {
      purchaseId: purchase.id,
      unsignedXdr: '',
      expiresAt: purchase.expiresAt,
      contractId: purchase.contractId,
      networkPassphrase: purchase.networkPassphrase,
      assetId: purchase.assetId,
      amount: purchase.amount,
      idempotencyKey: purchase.idempotencyKey,
    };
  }
}
