import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IndexerService } from './indexer.service';
import { TokenTransaction } from './entities/token-transaction.entity';

describe('IndexerService', () => {
  let service: IndexerService;
  let txRepo: jest.Mocked<Repository<TokenTransaction>>;

  const createRepoMock = <T,>() =>
    ({
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    }) as unknown as jest.Mocked<Repository<T>>;

  beforeEach(async () => {
    txRepo = createRepoMock<TokenTransaction>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndexerService,
        { provide: getRepositoryToken(TokenTransaction), useValue: txRepo },
      ],
    }).compile();

    service = module.get(IndexerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('records a transaction with normalized nullable fields', async () => {
    txRepo.create.mockReturnValue({ wallet: 'GB1', amount: 5 } as TokenTransaction);
    txRepo.save.mockResolvedValue({ id: 'tx-1', wallet: 'GB1', amount: 5 } as TokenTransaction);

    await expect(
      service.recordTransaction({ wallet: 'GB1', amount: 5 }),
    ).resolves.toEqual(expect.objectContaining({ id: 'tx-1', wallet: 'GB1', amount: 5 }));

    expect(txRepo.create).toHaveBeenCalledWith({
      wallet: 'GB1',
      amount: 5,
      promptId: null,
      metadata: null,
    });
    expect(txRepo.save).toHaveBeenCalledTimes(1);
  });

  it('builds the transaction query with filters, sort, and pagination', async () => {
    const qb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 'tx-1' }]),
    };
    txRepo.createQueryBuilder.mockReturnValue(qb as never);

    const from = new Date('2024-01-01T00:00:00.000Z');
    const to = new Date('2024-01-31T00:00:00.000Z');

    await expect(
      service.queryTransactions({ wallet: 'GB1', from, to, offset: 10, limit: 25 }),
    ).resolves.toEqual([{ id: 'tx-1' }]);

    expect(txRepo.createQueryBuilder).toHaveBeenCalledWith('tx');
    expect(qb.andWhere).toHaveBeenNthCalledWith(1, 'tx.wallet = :wallet', { wallet: 'GB1' });
    expect(qb.andWhere).toHaveBeenNthCalledWith(2, 'tx.createdAt >= :from', { from });
    expect(qb.andWhere).toHaveBeenNthCalledWith(3, 'tx.createdAt <= :to', { to });
    expect(qb.orderBy).toHaveBeenCalledWith('tx.createdAt', 'DESC');
    expect(qb.skip).toHaveBeenCalledWith(10);
    expect(qb.take).toHaveBeenCalledWith(25);
    expect(qb.getMany).toHaveBeenCalledTimes(1);
  });

  it('uses defaults when querying transactions without filters', async () => {
    const qb = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    txRepo.createQueryBuilder.mockReturnValue(qb as never);

    await expect(service.queryTransactions()).resolves.toEqual([]);

    expect(qb.andWhere).not.toHaveBeenCalled();
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.take).toHaveBeenCalledWith(50);
  });

  it('aggregates total consumed tokens for a wallet', async () => {
    const qb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '123.45' }),
    };
    txRepo.createQueryBuilder.mockReturnValue(qb as never);

    await expect(service.getTotalConsumed('GB1')).resolves.toBe(123.45);
    expect(txRepo.createQueryBuilder).toHaveBeenCalledWith('tx');
    expect(qb.select).toHaveBeenCalledWith('COALESCE(SUM(tx.amount), 0)', 'total');
    expect(qb.where).toHaveBeenCalledWith('tx.wallet = :wallet', { wallet: 'GB1' });
    expect(qb.getRawOne).toHaveBeenCalledTimes(1);
  });
});
