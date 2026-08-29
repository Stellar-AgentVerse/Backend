/* eslint-disable @typescript-eslint/unbound-method --
 * `expect(mock.method)` passes a method reference to a jest matcher, which is a
 * documented false positive for this rule. The alternative is restructuring the
 * assertions around a linter limitation rather than around what they verify.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WalletService, toLedgerReference } from './wallet.service';
import {
  Wallet,
  CreditPackage,
  WalletTransaction,
  TransactionType,
} from '../database/entities';
import { OnChainBalanceStatus } from './dto/wallet-response.dto';
import { CREDIT_PURCHASE_NOT_AVAILABLE } from './wallet.capabilities';

const UNAVAILABLE_ON_CHAIN = {
  status: OnChainBalanceStatus.UNAVAILABLE,
  reason: 'STELLAR_BALANCE_NOT_INTEGRATED',
  xlmBalance: null,
  xlmUsdEstimate: null,
  asOf: null,
};

describe('WalletService', () => {
  let service: WalletService;
  let walletRepo: jest.Mocked<Repository<Wallet>>;
  let pkgRepo: jest.Mocked<Repository<CreditPackage>>;
  let txRepo: jest.Mocked<Repository<WalletTransaction>>;

  const createRepoMock = <T>() =>
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

  describe('getBalance', () => {
    it('does not create a wallet row when reading a balance for an unknown wallet', async () => {
      walletRepo.findOne.mockResolvedValue(null);

      // monthlyAllocation matches the column default a created row would have
      // carried, so removing the write-on-read does not silently change what a
      // first-time caller sees.
      await expect(service.getBalance('GBUSER')).resolves.toEqual({
        credits: 0,
        monthlyUsage: 0,
        monthlyAllocation: 100,
        usagePercent: 0,
        onChain: UNAVAILABLE_ON_CHAIN,
      });

      expect(walletRepo.create).not.toHaveBeenCalled();
      expect(walletRepo.save).not.toHaveBeenCalled();
    });

    it('returns first-party credit state and an explicitly unavailable on-chain balance', async () => {
      walletRepo.findOne.mockResolvedValue({
        id: 'wallet-1',
        userPublicKey: 'GBUSER',
        credits: '120',
        xlmBalance: '2.25',
        monthlyUsage: '10',
        monthlyAllocation: '40',
      } as Wallet);

      const result = await service.getBalance('GBUSER');

      expect(result).toEqual({
        credits: 120,
        monthlyUsage: 10,
        monthlyAllocation: 40,
        usagePercent: 25,
        onChain: UNAVAILABLE_ON_CHAIN,
      });
      expect(walletRepo.save).not.toHaveBeenCalled();
    });

    it('never presents a persisted xlmBalance or a derived USD figure', async () => {
      walletRepo.findOne.mockResolvedValue({
        id: 'wallet-1',
        userPublicKey: 'GBUSER',
        credits: '0',
        xlmBalance: '1240.45',
        monthlyUsage: '0',
        monthlyAllocation: '100',
      } as Wallet);

      const serialized = JSON.stringify(await service.getBalance('GBUSER'));

      expect(serialized).not.toContain('1240.45');
      expect(serialized).not.toMatch(/xlmBalance":\s*[0-9]/);
      expect(serialized).not.toMatch(/xlmUsdEstimate":\s*[0-9]/);
    });

    it('reports zero usage when no allocation is set rather than dividing by zero', async () => {
      walletRepo.findOne.mockResolvedValue({
        credits: '5',
        monthlyUsage: '3',
        monthlyAllocation: '0',
      } as Wallet);

      await expect(service.getBalance('GBUSER')).resolves.toMatchObject({
        usagePercent: 0,
      });
    });
  });

  describe('getPackages', () => {
    it('advertises packages as not purchasable alongside a capability reason', async () => {
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

      const result = await service.getPackages();

      expect(result.purchase.supported).toBe(false);
      expect(result.purchase.reason).toBe(CREDIT_PURCHASE_NOT_AVAILABLE);
      expect(result.purchase.message.length).toBeGreaterThan(0);
      expect(result.packages).toEqual([
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
          purchasable: false,
        },
      ]);
      expect(pkgRepo.find).toHaveBeenCalledWith({
        order: { sortOrder: 'ASC' },
      });
    });

    it('still reports the capability when no packages are configured', async () => {
      pkgRepo.find.mockResolvedValue([]);

      // An empty array alone would be indistinguishable from "no packages
      // configured"; the capability block is what tells a client which it is.
      const result = await service.getPackages();

      expect(result.packages).toEqual([]);
      expect(result.purchase.supported).toBe(false);
    });
  });

  describe('getTransactions', () => {
    it('returns empty transactions when the wallet does not exist', async () => {
      walletRepo.findOne.mockResolvedValue(null);

      await expect(service.getTransactions('GBUSER')).resolves.toEqual([]);
      expect(txRepo.find).not.toHaveBeenCalled();
    });

    it('reports a fabricated txid as having no verified ledger reference', async () => {
      walletRepo.findOne.mockResolvedValue({
        id: 'wallet-1',
        userPublicKey: 'GBUSER',
      } as Wallet);
      txRepo.find.mockResolvedValue([
        {
          id: 'tx-1',
          type: TransactionType.REFILL,
          description: 'Top up',
          txid: 'tx-1700000000000-ab12cd',
          amount: '50',
          currency: 'Credits',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
        {
          id: 'tx-2',
          type: TransactionType.PURCHASE,
          description: 'Seeded row',
          txid: '0x82f...e31',
          amount: '-120',
          currency: 'Credits',
          createdAt: new Date('2023-10-24T00:00:00.000Z'),
        },
      ] as WalletTransaction[]);

      const result = await service.getTransactions('GBUSER', 5, 2);

      expect(result.map((tx) => tx.ledgerReference)).toEqual([null, null]);
      expect(JSON.stringify(result)).not.toContain('0x82f');
      expect(JSON.stringify(result)).not.toContain('tx-1700000000000');
      expect(txRepo.find).toHaveBeenCalledWith({
        where: { walletId: 'wallet-1' },
        order: { createdAt: 'DESC' },
        take: 5,
        skip: 2,
      });
    });

    it('passes through a genuine Stellar transaction hash', async () => {
      const hash = 'a'.repeat(64);
      walletRepo.findOne.mockResolvedValue({ id: 'wallet-1' } as Wallet);
      txRepo.find.mockResolvedValue([
        {
          id: 'tx-1',
          type: TransactionType.INCOME,
          description: 'Settled',
          txid: hash,
          amount: '1',
          currency: 'Credits',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ] as WalletTransaction[]);

      const [tx] = await service.getTransactions('GBUSER');

      expect(tx.ledgerReference).toBe(hash);
    });

    it.each([
      [undefined, undefined, 20, 0],
      [100000, -5, 100, 0],
      [0, 0, 1, 0],
      [Number.NaN, Number.NaN, 20, 0],
      // Infinity is not finite, so it falls back to the default rather than
      // clamping to the maximum — Postgres rejects OFFSET Infinity outright.
      [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, 20, 0],
      [5.9, 2.9, 5, 2],
    ])(
      'sanitises limit=%s skip=%s to take=%s skip=%s',
      async (limit, skip, take, expectedSkip) => {
        walletRepo.findOne.mockResolvedValue({ id: 'wallet-1' } as Wallet);
        txRepo.find.mockResolvedValue([]);

        await service.getTransactions('GBUSER', limit, skip);

        // NaN would reach TypeORM's take() and throw a non-HTTP error, turning
        // a client typo (?limit=abc) into a 500.
        expect(txRepo.find).toHaveBeenCalledWith(
          expect.objectContaining({ take, skip: expectedSkip }),
        );
      },
    );
  });

  describe('toLedgerReference', () => {
    it('accepts only a 64-character lowercase hex hash', () => {
      expect(toLedgerReference('b'.repeat(64))).toBe('b'.repeat(64));
      expect(toLedgerReference('B'.repeat(64))).toBeNull();
      expect(toLedgerReference('a'.repeat(63))).toBeNull();
      expect(toLedgerReference('a'.repeat(65))).toBeNull();
      expect(toLedgerReference('0x' + 'a'.repeat(62))).toBeNull();
      expect(toLedgerReference('')).toBeNull();
      expect(toLedgerReference(null)).toBeNull();
    });
  });
});
