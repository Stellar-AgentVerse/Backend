import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { sorobanConfig } from '../tokens/config/soroban.config';
import { Asset, AssetType } from '../database/entities';
import { Purchase, PurchaseStatus } from '../database/entities/purchase.entity';
import { PurchasesService } from './purchases.service';

describe('PurchasesService', () => {
  let service: PurchasesService;
  let purchaseRepo: jest.Mocked<Repository<Purchase>>;
  let assetRepo: jest.Mocked<Repository<Asset>>;

  const mockSorobanConfig = {
    network: 'testnet',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    contracts: {
      tokenMint: '',
      tokenSale: '',
      purchaseContractId: '',
    },
    adminSecretKey: '',
  };

  const createRepoMock = <T>() =>
    ({
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    }) as unknown as jest.Mocked<Repository<T>>;

  beforeEach(async () => {
    purchaseRepo = createRepoMock<Purchase>();
    assetRepo = createRepoMock<Asset>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasesService,
        { provide: getRepositoryToken(Purchase), useValue: purchaseRepo },
        { provide: getRepositoryToken(Asset), useValue: assetRepo },
        { provide: sorobanConfig.KEY, useValue: mockSorobanConfig },
      ],
    }).compile();

    service = module.get(PurchasesService);
    service.onModuleInit();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  // ─── createIntent ──────────────────────────────────────────

  describe('createIntent', () => {
    const buyerKey = 'GBUYERKEY12345';
    const assetId = 'b9f0c1f0-0000-0000-0000-000000000000';

    it('creates a purchase intent for a published PROMPT asset in mock mode', async () => {
      const publishedAsset = {
        id: assetId,
        type: AssetType.PROMPT,
        status: 'PUBLISHED',
        price: 25,
      } as Asset;

      assetRepo.findOne.mockResolvedValue(publishedAsset);
      purchaseRepo.findOne.mockResolvedValue(null);
      const createdPurchase = {
        id: 'purchase-1',
        assetId,
        buyerPublicKey: buyerKey,
        status: PurchaseStatus.PENDING,
        idempotencyKey: 'idem-001',
        contractId: 'MOCK_CONTRACT',
        networkPassphrase: 'Test SDF Network ; September 2015',
        amount: 25,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        transactionHash: null,
        confirmedAt: null,
      } as Purchase;
      purchaseRepo.create.mockReturnValue(createdPurchase);
      purchaseRepo.save.mockResolvedValue(createdPurchase);

      const result = await service.createIntent(assetId, buyerKey, 'idem-001');

      expect(result).toMatchObject({
        purchaseId: 'purchase-1',
        assetId,
        amount: 25,
        idempotencyKey: 'idem-001',
      });
      expect(result.unsignedXdr).toContain('mock-unsigned-xdr');
      expect(assetRepo.findOne).toHaveBeenCalledWith({ where: { id: assetId } });
    });

    it('rejects non-existent asset', async () => {
      assetRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createIntent(assetId, buyerKey, 'idem-002'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects non-published asset', async () => {
      const draftAsset = {
        id: assetId,
        type: AssetType.PROMPT,
        status: 'DRAFT',
        price: 25,
      } as Asset;

      assetRepo.findOne.mockResolvedValue(draftAsset);

      await expect(
        service.createIntent(assetId, buyerKey, 'idem-003'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects non-PROMPT asset type', async () => {
      const agentAsset = {
        id: assetId,
        type: AssetType.AGENT,
        status: 'PUBLISHED',
        price: 25,
      } as Asset;

      assetRepo.findOne.mockResolvedValue(agentAsset);

      await expect(
        service.createIntent(assetId, buyerKey, 'idem-004'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns existing purchase for same idempotency key', async () => {
      const publishedAsset = {
        id: assetId,
        type: AssetType.PROMPT,
        status: 'PUBLISHED',
        price: 25,
      } as Asset;
      const existingPurchase = {
        id: 'existing-id',
        assetId,
        buyerPublicKey: buyerKey,
        status: PurchaseStatus.PENDING,
        idempotencyKey: 'idem-005',
        contractId: 'MOCK_CONTRACT',
        networkPassphrase: 'Test Network',
        amount: 25,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        transactionHash: null,
        confirmedAt: null,
      } as Purchase;

      assetRepo.findOne.mockResolvedValue(publishedAsset);
      purchaseRepo.findOne.mockResolvedValue(existingPurchase);

      const result = await service.createIntent(assetId, buyerKey, 'idem-005');

      expect(result.purchaseId).toBe('existing-id');
      expect(purchaseRepo.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException for already-verified purchase with same key', async () => {
      const publishedAsset = {
        id: assetId,
        type: AssetType.PROMPT,
        status: 'PUBLISHED',
        price: 25,
      } as Asset;
      const verifiedPurchase = {
        id: 'verified-id',
        assetId,
        status: PurchaseStatus.VERIFIED,
        idempotencyKey: 'idem-006',
      } as Purchase;

      assetRepo.findOne.mockResolvedValue(publishedAsset);
      purchaseRepo.findOne.mockResolvedValue(verifiedPurchase);

      await expect(
        service.createIntent(assetId, buyerKey, 'idem-006'),
      ).rejects.toThrow(ConflictException);
    });

    it('generates a random idempotency key when none provided', async () => {
      const publishedAsset = {
        id: assetId,
        type: AssetType.PROMPT,
        status: 'PUBLISHED',
        price: 10,
      } as Asset;

      assetRepo.findOne.mockResolvedValue(publishedAsset);
      purchaseRepo.findOne.mockResolvedValue(null);
      purchaseRepo.create.mockImplementation((dto) => dto as Purchase);
      purchaseRepo.save.mockResolvedValue({} as never);

      await service.createIntent(assetId, buyerKey);

      expect(purchaseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: expect.any(String),
        }),
      );
    });
  });

  // ─── confirm ────────────────────────────────────────────────

  describe('confirm', () => {
    const buyerKey = 'GBUYERKEY12345';
    const otherKey = 'GOTHERKEY99999';
    const purchaseId = 'purchase-1';
    const txHash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

    it('confirms a pending purchase in mock mode', async () => {
      const pendingPurchase = {
        id: purchaseId,
        assetId: 'asset-1',
        buyerPublicKey: buyerKey,
        status: PurchaseStatus.PENDING,
        idempotencyKey: 'idem-001',
        contractId: 'MOCK_CONTRACT',
        networkPassphrase: 'Test Network',
        amount: 25,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        transactionHash: null,
        confirmedAt: null,
      } as Purchase;

      purchaseRepo.findOne
        .mockResolvedValueOnce(pendingPurchase) // first call: find purchase
        .mockResolvedValueOnce(null); // second call: check duplicate hash
      purchaseRepo.save.mockResolvedValue({} as never);

      const result = await service.confirm(purchaseId, txHash, buyerKey);

      expect(result.status).toBe(PurchaseStatus.VERIFIED);
      expect(purchaseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PurchaseStatus.VERIFIED,
          transactionHash: txHash,
          confirmedAt: expect.any(Date),
        }),
      );
    });

    it('rejects non-existent purchase', async () => {
      purchaseRepo.findOne.mockResolvedValue(null);

      await expect(
        service.confirm('nonexistent', txHash, buyerKey),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects already verified purchase', async () => {
      const verifiedPurchase = {
        id: purchaseId,
        status: PurchaseStatus.VERIFIED,
        buyerPublicKey: buyerKey,
      } as Purchase;

      purchaseRepo.findOne.mockResolvedValue(verifiedPurchase);

      await expect(
        service.confirm(purchaseId, txHash, buyerKey),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects purchase owned by different user', async () => {
      const pendingPurchase = {
        id: purchaseId,
        status: PurchaseStatus.PENDING,
        buyerPublicKey: buyerKey,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      } as Purchase;

      purchaseRepo.findOne.mockResolvedValue(pendingPurchase);

      await expect(
        service.confirm(purchaseId, txHash, otherKey),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects expired purchase', async () => {
      const expiredPurchase = {
        id: purchaseId,
        status: PurchaseStatus.PENDING,
        buyerPublicKey: buyerKey,
        expiresAt: new Date(Date.now() - 60 * 1000),
      } as Purchase;

      purchaseRepo.findOne.mockResolvedValue(expiredPurchase);

      await expect(
        service.confirm(purchaseId, txHash, buyerKey),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects duplicate transaction hash', async () => {
      const pendingPurchase = {
        id: purchaseId,
        status: PurchaseStatus.PENDING,
        buyerPublicKey: buyerKey,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      } as Purchase;
      const existingWithHash = { id: 'other-purchase' } as Purchase;

      purchaseRepo.findOne
        .mockResolvedValueOnce(pendingPurchase)
        .mockResolvedValueOnce(existingWithHash);

      await expect(
        service.confirm(purchaseId, txHash, buyerKey),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── getAccess ──────────────────────────────────────────────

  describe('getAccess', () => {
    const buyerKey = 'GBUYERKEY12345';
    const otherKey = 'GOTHERKEY99999';
    const purchaseId = 'purchase-1';

    it('returns delivery reference for verified purchase owner', async () => {
      const verifiedPurchase = {
        id: purchaseId,
        assetId: 'asset-1',
        buyerPublicKey: buyerKey,
        status: PurchaseStatus.VERIFIED,
        confirmedAt: new Date('2026-07-21T12:00:00Z'),
      } as Purchase;

      purchaseRepo.findOne.mockResolvedValue(verifiedPurchase);

      const result = await service.getAccess(purchaseId, buyerKey);

      expect(result).toMatchObject({
        purchaseId,
        assetId: 'asset-1',
        deliveryReference: expect.stringContaining('asset://'),
        purchasedAt: expect.any(Date),
      });
    });

    it('rejects non-owner', async () => {
      const verifiedPurchase = {
        id: purchaseId,
        buyerPublicKey: buyerKey,
        status: PurchaseStatus.VERIFIED,
      } as Purchase;

      purchaseRepo.findOne.mockResolvedValue(verifiedPurchase);

      await expect(
        service.getAccess(purchaseId, otherKey),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects non-verified purchase', async () => {
      const pendingPurchase = {
        id: purchaseId,
        buyerPublicKey: buyerKey,
        status: PurchaseStatus.PENDING,
      } as Purchase;

      purchaseRepo.findOne.mockResolvedValue(pendingPurchase);

      await expect(
        service.getAccess(purchaseId, buyerKey),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects non-existent purchase', async () => {
      purchaseRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getAccess('nonexistent', buyerKey),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
