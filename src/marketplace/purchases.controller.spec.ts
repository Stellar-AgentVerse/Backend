import { Test, TestingModule } from '@nestjs/testing';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { JwtPayload } from '../auth/common/interfaces/jwt-payload.interface';

describe('PurchasesController', () => {
  let controller: PurchasesController;
  let purchasesService: jest.Mocked<PurchasesService>;

  const mockUser: JwtPayload = {
    publicKey: 'GBUYERKEY12345',
    iat: Math.floor(Date.now() / 1000),
  };

  beforeEach(async () => {
    const serviceMock = {
      createIntent: jest.fn(),
      confirm: jest.fn(),
      getAccess: jest.fn(),
    } as unknown as jest.Mocked<PurchasesService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchasesController],
      providers: [{ provide: PurchasesService, useValue: serviceMock }],
    }).compile();

    controller = module.get(PurchasesController);
    purchasesService = module.get(PurchasesService) as jest.Mocked<PurchasesService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createIntent', () => {
    it('delegates to service with the authenticated user publicKey', async () => {
      const dto = { assetId: 'asset-1', idempotencyKey: 'idem-001' };
      const expected = {
        purchaseId: 'purchase-1',
        unsignedXdr: 'AAAA...',
        expiresAt: new Date(),
        contractId: 'contract-1',
        networkPassphrase: 'Test Network',
        assetId: 'asset-1',
        amount: 25,
        idempotencyKey: 'idem-001',
      };

      purchasesService.createIntent.mockResolvedValue(expected);

      const result = await controller.createIntent(dto, mockUser);

      expect(result).toEqual(expected);
      expect(purchasesService.createIntent).toHaveBeenCalledWith(
        'asset-1',
        mockUser.publicKey,
        'idem-001',
      );
    });

    it('delegates without optional idempotencyKey', async () => {
      const dto = { assetId: 'asset-1' };

      purchasesService.createIntent.mockResolvedValue({
        purchaseId: 'purchase-2',
        unsignedXdr: 'AAAA...',
        expiresAt: new Date(),
        contractId: 'contract-1',
        networkPassphrase: 'Test Network',
        assetId: 'asset-1',
        amount: 10,
        idempotencyKey: 'auto-gen',
      });

      await controller.createIntent(dto, mockUser);

      expect(purchasesService.createIntent).toHaveBeenCalledWith(
        'asset-1',
        mockUser.publicKey,
        undefined,
      );
    });
  });

  describe('confirm', () => {
    it('delegates to service with the authenticated user publicKey', async () => {
      const dto = { transactionHash: '0xh4sh...' };
      const expected = { purchaseId: 'purchase-1', status: 'VERIFIED' };

      purchasesService.confirm.mockResolvedValue(expected);

      const result = await controller.confirm('purchase-1', dto, mockUser);

      expect(result).toEqual(expected);
      expect(purchasesService.confirm).toHaveBeenCalledWith(
        'purchase-1',
        '0xh4sh...',
        mockUser.publicKey,
      );
    });
  });

  describe('getAccess', () => {
    it('delegates to service with the authenticated user publicKey', async () => {
      const expected = {
        purchaseId: 'purchase-1',
        assetId: 'asset-1',
        deliveryReference: 'asset://asset-1/purchase/purchase-1',
        purchasedAt: new Date(),
      };

      purchasesService.getAccess.mockResolvedValue(expected);

      const result = await controller.getAccess('purchase-1', mockUser);

      expect(result).toEqual(expected);
      expect(purchasesService.getAccess).toHaveBeenCalledWith(
        'purchase-1',
        mockUser.publicKey,
      );
    });
  });
});
