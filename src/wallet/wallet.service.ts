import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet, CreditPackage, WalletTransaction } from '../database/entities';
import {
  WalletBalanceDto,
  CreditPackageDto,
  CreditPackagesDto,
  OnChainBalanceStatus,
  STELLAR_BALANCE_NOT_INTEGRATED,
  WalletTransactionDto,
} from './dto/wallet-response.dto';
import { CREDIT_PURCHASE_CAPABILITY } from './wallet.capabilities';

/** Stellar transaction hashes are 32 bytes rendered as lowercase hex. */
const STELLAR_TX_HASH = /^[0-9a-f]{64}$/;

const MAX_TRANSACTION_PAGE_SIZE = 100;
const DEFAULT_TRANSACTION_PAGE_SIZE = 20;

/** Mirrors the column default in `Wallet` so a caller with no row yet sees the
 *  same allocation a freshly created one would have had. */
const DEFAULT_MONTHLY_ALLOCATION = 100;

/**
 * No verified Stellar balance source is wired up, so the on-chain half of a
 * balance is reported as explicitly unavailable rather than as zero. Zero would
 * be a claim about someone's money, and an absent field would leave a client
 * rendering `undefined` with no way to say why.
 */
const ON_CHAIN_UNAVAILABLE = Object.freeze({
  status: OnChainBalanceStatus.UNAVAILABLE,
  reason: STELLAR_BALANCE_NOT_INTEGRATED,
  xlmBalance: null,
  xlmUsdEstimate: null,
  asOf: null,
});

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(CreditPackage)
    private readonly pkgRepo: Repository<CreditPackage>,
    @InjectRepository(WalletTransaction)
    private readonly txRepo: Repository<WalletTransaction>,
  ) {}

  /**
   * Reading a balance never creates a wallet row. The previous implementation
   * persisted one for whatever string arrived in the `user` query parameter,
   * which made an unauthenticated GET a write.
   */
  async getBalance(userPublicKey: string): Promise<WalletBalanceDto> {
    const wallet = await this.walletRepo.findOne({ where: { userPublicKey } });

    const credits = Number(wallet?.credits ?? 0);
    const monthlyUsage = Number(wallet?.monthlyUsage ?? 0);
    const monthlyAllocation = Number(
      wallet?.monthlyAllocation ?? DEFAULT_MONTHLY_ALLOCATION,
    );

    return {
      credits,
      monthlyUsage,
      monthlyAllocation,
      usagePercent:
        monthlyAllocation > 0
          ? Number(((monthlyUsage / monthlyAllocation) * 100).toFixed(1))
          : 0,
      onChain: { ...ON_CHAIN_UNAVAILABLE },
    };
  }

  async getPackages(): Promise<CreditPackagesDto> {
    const packages = await this.pkgRepo.find({ order: { sortOrder: 'ASC' } });

    return {
      purchase: { ...CREDIT_PURCHASE_CAPABILITY },
      packages: packages.map(
        (p): CreditPackageDto => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          icon: p.icon,
          credits: p.credits,
          price: Number(p.price),
          originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
          features: p.features,
          popular: p.popular,
          purchasable: CREDIT_PURCHASE_CAPABILITY.supported,
        }),
      ),
    };
  }

  async getTransactions(
    userPublicKey: string,
    limit?: number,
    skip?: number,
  ): Promise<WalletTransactionDto[]> {
    const wallet = await this.walletRepo.findOne({ where: { userPublicKey } });
    if (!wallet) return [];

    const txs = await this.txRepo.find({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      take: toPageSize(limit),
      skip: toOffset(skip),
    });

    return txs.map((tx) => ({
      id: tx.id,
      type: tx.type,
      description: tx.description,
      ledgerReference: toLedgerReference(tx.txid),
      amount: Number(tx.amount),
      currency: tx.currency,
      createdAt: tx.createdAt,
    }));
  }
}

/**
 * `@Query('limit')` is declared `number` but arrives as a string, and the global
 * ValidationPipe coerces it with `Number(...)`. `?limit=abc` therefore reaches
 * the service as NaN, which TypeORM rejects with a non-HTTP error — a 500 for
 * what is a client mistake. Anything not a finite number falls back to the
 * documented default rather than reaching the query builder.
 */
function toPageSize(value?: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_TRANSACTION_PAGE_SIZE;
  return Math.min(Math.max(Math.trunc(parsed), 1), MAX_TRANSACTION_PAGE_SIZE);
}

function toOffset(value?: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(Math.trunc(parsed), 0);
}

/**
 * Only a value that is actually shaped like a settled Stellar transaction hash
 * is presented as one. Historic rows hold seeded strings (`0x82f...e31`) and
 * ids minted by the removed simulated purchase path (`tx-<epoch>-<random>`);
 * both fail this check and are reported as "no verified reference" rather than
 * being dressed up as on-chain activity.
 */
export function toLedgerReference(txid: string | null): string | null {
  return txid && STELLAR_TX_HASH.test(txid) ? txid : null;
}
