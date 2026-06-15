import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Wallet,
  CreditPackage,
  WalletTransaction,
  TransactionType,
} from '../database/entities';
import {
  WalletBalanceDto,
  CreditPackageDto,
  WalletTransactionDto,
  PurchaseResultDto,
} from './dto/wallet-response.dto';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(CreditPackage)
    private readonly pkgRepo: Repository<CreditPackage>,
    @InjectRepository(WalletTransaction)
    private readonly txRepo: Repository<WalletTransaction>,
  ) {}

  async getBalance(userPublicKey: string): Promise<WalletBalanceDto> {
    let wallet = await this.walletRepo.findOne({ where: { userPublicKey } });
    if (!wallet) {
      wallet = this.walletRepo.create({
        userPublicKey,
        credits: 0,
        xlmBalance: 0,
        monthlyUsage: 0,
        monthlyAllocation: 100,
      });
      wallet = await this.walletRepo.save(wallet);
    }

    return {
      credits: Number(wallet.credits),
      xlmBalance: Number(wallet.xlmBalance),
      monthlyUsage: Number(wallet.monthlyUsage),
      monthlyAllocation: Number(wallet.monthlyAllocation),
      usagePercent: wallet.monthlyAllocation > 0
        ? Number((wallet.monthlyUsage / wallet.monthlyAllocation * 100).toFixed(1))
        : 0,
      xlmUsdEstimate: Number((Number(wallet.xlmBalance) * 0.112).toFixed(2)),
    };
  }

  async getPackages(): Promise<CreditPackageDto[]> {
    const packages = await this.pkgRepo.find({
      order: { sortOrder: 'ASC' },
    });
    return packages.map((p) => ({
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
    }));
  }

  async getTransactions(
    userPublicKey: string,
    limit = 20,
    skip = 0,
  ): Promise<WalletTransactionDto[]> {
    const wallet = await this.walletRepo.findOne({ where: { userPublicKey } });
    if (!wallet) return [];

    const txs = await this.txRepo.find({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });
    return txs.map((tx) => ({
      id: tx.id,
      type: tx.type,
      description: tx.description,
      txid: tx.txid,
      amount: Number(tx.amount),
      currency: tx.currency,
      createdAt: tx.createdAt,
    }));
  }

  async purchasePackage(
    userPublicKey: string,
    packageId: string,
  ): Promise<PurchaseResultDto> {
    const pkg = await this.pkgRepo.findOne({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('Package not found');

    let wallet = await this.walletRepo.findOne({ where: { userPublicKey } });
    if (!wallet) {
      wallet = this.walletRepo.create({
        userPublicKey,
        credits: 0,
        xlmBalance: 0,
      });
    }

    // Deduct XLM (simulated — real payment flow will go through payments module)
    if (Number(wallet.xlmBalance) < Number(pkg.price)) {
      throw new BadRequestException(
        `Insufficient XLM balance. Need ${pkg.price} XLM, have ${wallet.xlmBalance}`,
      );
    }

    wallet.xlmBalance = Number(wallet.xlmBalance) - Number(pkg.price);
    wallet.credits = Number(wallet.credits) + pkg.credits;
    wallet = await this.walletRepo.save(wallet);

    const tx = this.txRepo.create({
      walletId: wallet.id,
      type: TransactionType.REFILL,
      description: `Resource Refill: ${pkg.name} Pack`,
      txid: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      amount: pkg.credits,
      currency: 'Credits',
    });
    const savedTx = await this.txRepo.save(tx);

    this.logger.log(
      `Package purchased: ${pkg.name} — user=${userPublicKey}, credits=${pkg.credits}`,
    );

    return {
      transaction: {
        id: savedTx.id,
        type: savedTx.type,
        description: savedTx.description,
        txid: savedTx.txid,
        amount: Number(savedTx.amount),
        currency: savedTx.currency,
        createdAt: savedTx.createdAt,
      },
      credits: Number(wallet.credits),
      message: `Successfully purchased ${pkg.name} pack. ${pkg.credits} credits added.`,
    };
  }
}
