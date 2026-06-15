import { Test, TestingModule } from '@nestjs/testing';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { PurchasePackageDto } from './dto/wallet-response.dto';

describe('WalletController', () => {
  let controller: WalletController;
  let walletService: jest.Mocked<WalletService>;

  beforeEach(async () => {
    const walletServiceMock = {
      getBalance: jest.fn(),
      getPackages: jest.fn(),
      getTransactions: jest.fn(),
      purchasePackage: jest.fn(),
    } as unknown as jest.Mocked<WalletService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [{ provide: WalletService, useValue: walletServiceMock }],
    }).compile();

    controller = module.get(WalletController);
    walletService = module.get(WalletService) as jest.Mocked<WalletService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uses the placeholder user when balance is requested without a user query', async () => {
    const balance = { credits: 0 };
    walletService.getBalance.mockResolvedValue(balance as never);

    await expect(controller.getBalance()).resolves.toEqual(balance);
    expect(walletService.getBalance).toHaveBeenCalledWith('anon-placeholder');
  });

  it('delegates getPackages to WalletService', async () => {
    const packages = [{ id: 'pkg-1' }];
    walletService.getPackages.mockResolvedValue(packages as never);

    await expect(controller.getPackages()).resolves.toEqual(packages);
    expect(walletService.getPackages).toHaveBeenCalledTimes(1);
  });

  it('uses default paging and placeholder user for transactions', async () => {
    const txs = [{ id: 'tx-1' }];
    walletService.getTransactions.mockResolvedValue(txs as never);

    await expect(controller.getTransactions()).resolves.toEqual(txs);
    expect(walletService.getTransactions).toHaveBeenCalledWith('anon-placeholder', 20, 0);
  });

  it('delegates purchase requests with an explicit user', async () => {
    const dto: PurchasePackageDto = { packageId: 'pkg-1' };
    const result = { message: 'ok' };
    walletService.purchasePackage.mockResolvedValue(result as never);

    await expect(controller.purchase(dto, 'GBUSER...')).resolves.toEqual(result);
    expect(walletService.purchasePackage).toHaveBeenCalledWith('GBUSER...', 'pkg-1');
  });

  it('uses the placeholder user when purchase is requested without a user query', async () => {
    const dto: PurchasePackageDto = { packageId: 'pkg-1' };
    const result = { message: 'ok' };
    walletService.purchasePackage.mockResolvedValue(result as never);

    await expect(controller.purchase(dto)).resolves.toEqual(result);
    expect(walletService.purchasePackage).toHaveBeenCalledWith('anon-placeholder', 'pkg-1');
  });
});
