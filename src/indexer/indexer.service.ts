import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenTransaction } from './entities/token-transaction.entity';

export interface RecordTransactionParams {
  wallet: string;
  amount: number;
  promptId?: string;
  metadata?: Record<string, unknown>;
}

export interface TransactionQuery {
  wallet?: string;
  limit?: number;
  offset?: number;
  from?: Date;
  to?: Date;
}

@Injectable()
export class IndexerService {
  private readonly logger = new Logger(IndexerService.name);

  constructor(
    @InjectRepository(TokenTransaction)
    private readonly txRepo: Repository<TokenTransaction>,
  ) {}

  /**
   * Registra un consumo de tokens (prompt) en la base de datos.
   */
  async recordTransaction(params: RecordTransactionParams): Promise<TokenTransaction> {
    const tx = this.txRepo.create({
      wallet: params.wallet,
      amount: params.amount,
      promptId: params.promptId ?? null,
      metadata: params.metadata ?? null,
    });

    const saved = await this.txRepo.save(tx);
    this.logger.debug(`Transaction recorded: ${saved.id} — wallet=${params.wallet}, amount=${params.amount}`);
    return saved;
  }

  /**
   * Consulta el historial de transacciones con filtros opcionales.
   */
  async queryTransactions(query: TransactionQuery = {}): Promise<TokenTransaction[]> {
    const qb = this.txRepo.createQueryBuilder('tx');

    if (query.wallet) {
      qb.andWhere('tx.wallet = :wallet', { wallet: query.wallet });
    }
    if (query.from) {
      qb.andWhere('tx.createdAt >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('tx.createdAt <= :to', { to: query.to });
    }

    qb.orderBy('tx.createdAt', 'DESC')
      .skip(query.offset ?? 0)
      .take(query.limit ?? 50);

    return qb.getMany();
  }

  /**
   * Obtiene el total de tokens consumidos por una wallet.
   */
  async getTotalConsumed(wallet: string): Promise<number> {
    const result = await this.txRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'total')
      .where('tx.wallet = :wallet', { wallet })
      .getRawOne();

    return Number(result?.total ?? 0);
  }
}
