import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletService } from './wallet.service';
import {
  Wallet,
  CreditPackage,
  WalletTransaction,
  TransactionType,
} from '../database/entities';

describe('WalletService', () => {
  let service: WalletService;
  let walletRepo: jest.Mocked<Repository<Wallet>>;
  let pkgRepo: jest.Mocked<Repository<CreditPackage>>;
  let txRepo: jest.Mocked<Repository<WalletTransaction>>;

  const createRepoMock = <T,>() =>
    ({
      create: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      save: jest.fn(),
    }) as unknown as jest.Mocked<Repository<T>>;

  beforeEach(async () => {
    walletRepo = createRepoMock<Wallet>();
    pkgRepo = createRepoMock<CreditPackage>();
    txRepo = createRepoMock<WalletTransaction>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: getRepositoryToken(Wallet), useValue: walletRepo },
        { provide: getRepositoryToken(CreditPackage), useValue: pkgRepo },
        { provide: getRepositoryToken(WalletTransaction), useValue: txRepo },
      ],
    }).compile();

    service = module.get(WalletService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('creates a wallet automatically when balance is requested for a new user', async () => {
    walletRepo.findOne.mockResolvedValue(null);
    walletRepo.create.mockReturnValue({
      id: 'wallet-1',
      userPublicKey: 'GBUSER',
      credits: 0,
      xlmBalance: 0,
      monthlyUsage: 0,
      monthlyAllocation: 100,
    } as Wallet);
    walletRepo.save.mockResolvedValue({
      id: 'wallet-1',
      userPublicKey: 'GBUSER',
      credits: '0',
      xlmBalance: '1.5',
      monthlyUsage: '25',
      monthlyAllocation: '100',
    } as Wallet);

    const result = await service.getBalance('GBUSER');

    expect(walletRepo.create).toHaveBeenCalledWith({
      userPublicKey: 'GBUSER',
      credits: 0,
      xlmBalance: 0,
      monthlyUsage: 0,
      monthlyAllocation: 100,
    });
    expect(walletRepo.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      credits: 0,
      xlmBalance: 1.5,
      monthlyUsage: 25,
      monthlyAllocation: 100,
      usagePercent: 25,
      xlmUsdEstimate: 0.17,
    });
  });

  it('returns the current balance for an existing wallet', async () => {
    walletRepo.findOne.mockResolvedValue({
      id: 'wallet-1',
      userPublicKey: 'GBUSER',
      credits: '120',
      xlmBalance: '2.25',
      monthlyUsage: '10',
      monthlyAllocation: '40',
    } as Wallet);

    await expect(service.getBalance('GBUSER')).resolves.toEqual({
      credits: 120,
      xlmBalance: 2.25,
      monthlyUsage: 10,
      monthlyAllocation: 40,
      usagePercent: 25,
      xlmUsdEstimate: 0.25,
    });
    expect(walletRepo.save).not.toHaveBeenCalled();
  });

  it('returns packages ordered by sort order', async () => {
    pkgRepo.find.mockResolvedValue([
      {
        id: 'pkg-1',
        name: 'Starter',
        slug: 'starter',
        description: 'Starter pack',
        icon: 'bolt',
        credits: 100,
        price: '4.00',
        originalPrice: '5.00',
        features: ['A'],
        popular: true,
      },
    ] as CreditPackage[]);

    await expect(service.getPackages()).resolves.toEqual([
      {
        id: 'pkg-1',
        name: 'Starter',
        slug: 'starter',
        description: 'Starter pack',
        icon: 'bolt',
        credits: 100,
        price: 4,
        originalPrice: 5,
        features: ['A'],
        popular: true,
      },
    ]);
    expect(pkgRepo.find).toHaveBeenCalledWith({ order: { sortOrder: 'ASC' } });
  });

  it('returns empty transactions when the wallet does not exist', async () => {
    walletRepo.findOne.mockResolvedValue(null);

    await expect(service.getTransactions('GBUSER')).resolves.toEqual([]);
    expect(txRepo.find).not.toHaveBeenCalled();
  });

  it('returns mapped transactions for an existing wallet', async () => {
    walletRepo.findOne.mockResolvedValue({
      id: 'wallet-1',
      userPublicKey: 'GBUSER',
    } as Wallet);
    txRepo.find.mockResolvedValue([
      {
        id: 'tx-1',
        type: TransactionType.REFILL,
        description: 'Top up',
        txid: 'tx-abc',
        amount: '50',
        currency: 'Credits',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    ] as WalletTransaction[]);

    await expect(service.getTransactions('GBUSER', 5, 2)).resolves.toEqual([
      {
        id: 'tx-1',
        type: TransactionType.REFILL,
        description: 'Top up',
        txid: 'tx-abc',
        amount: 50,
        currency: 'Credits',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
    ]);
    expect(txRepo.find).toHaveBeenCalledWith({
      where: { walletId: 'wallet-1' },
      order: { createdAt: 'DESC' },
      take: 5,
      skip: 2,
    });
  });

  it('throws when the requested package does not exist', async () => {
    pkgRepo.findOne.mockResolvedValue(null);

    await expect(service.purchasePackage('GBUSER', 'pkg-missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws when the wallet has insufficient balance', async () => {
    pkgRepo.findOne.mockResolvedValue({
      id: 'pkg-1',
      name: 'Starter',
      price: 5,
      credits: 100,
    } as CreditPackage);
    walletRepo.findOne.mockResolvedValue({
      id: 'wallet-1',
      userPublicKey: 'GBUSER',
      credits: 0,
      xlmBalance: 1,
    } as Wallet);

    await expect(service.purchasePackage('GBUSER', 'pkg-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(walletRepo.save).not.toHaveBeenCalled();
    expect(txRepo.create).not.toHaveBeenCalled();
  });

  it('purchases a package and records a deterministic transaction id', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1234567890);
    jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

    pkgRepo.findOne.mockResolvedValue({
      id: 'pkg-1',
      name: 'Starter',
      price: 5,
      credits: 100,
    } as CreditPackage);
    walletRepo.findOne.mockResolvedValue({
      id: 'wallet-1',
      userPublicKey: 'GBUSER',
      credits: 10,
      xlmBalance: 8,
    } as Wallet);
    walletRepo.save.mockResolvedValue({
      id: 'wallet-1',
      userPublicKey: 'GBUSER',
      credits: 110,
      xlmBalance: 3,
    } as Wallet);
    txRepo.create.mockImplementation((value) => value as WalletTransaction);
    txRepo.save.mockImplementation(async (value) => ({
      ...value,
      id: 'tx-1',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    } as WalletTransaction));

    const result = await service.purchasePackage('GBUSER', 'pkg-1');

    expect(txRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        walletId: 'wallet-1',
        type: TransactionType.REFILL,
        txid: expect.stringMatching(/^tx-1234567890-/),
        amount: 100,
        currency: 'Credits',
      }),
    );
    expect(result).toEqual({
      transaction: {
        id: 'tx-1',
        type: TransactionType.REFILL,
        description: 'Resource Refill: Starter Pack',
        txid: expect.stringMatching(/^tx-1234567890-/),
        amount: 100,
        currency: 'Credits',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      },
      credits: 110,
      message: 'Successfully purchased Starter pack. 100 credits added.',
    });
  });
});
