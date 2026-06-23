import { Test, TestingModule } from '@nestjs/testing';
import * as StellarSdk from '@stellar/stellar-sdk';
import { sorobanConfig } from './config/soroban.config';
import { TokensService } from './tokens.service';

jest.mock('@stellar/stellar-sdk', () => ({
  rpc: {
    Server: jest.fn(),
    assembleTransaction: jest.fn(),
  },
  Contract: jest.fn(),
  TransactionBuilder: jest.fn(),
  BASE_FEE: '100',
  nativeToScVal: jest.fn(),
  scValToNative: jest.fn(),
  Keypair: {
    fromSecret: jest.fn(),
  },
  Address: {
    fromString: jest.fn(),
  },
}));

describe('TokensService', () => {
  let service: TokensService;
  let mockRpcInstance: {
    getAccount: jest.Mock;
    simulateTransaction: jest.Mock;
    sendTransaction: jest.Mock;
  };
  let mockContractInstance: { call: jest.Mock };
  let mockKeypair: { publicKey: jest.Mock };
  let mockTx: { sign: jest.Mock };

  const defaultConfig = {
    network: 'testnet',
    rpcUrl: 'https://rpc.test',
    networkPassphrase: 'Test Network',
    contracts: { tokenMint: 'mint-contract', tokenSale: 'sale-contract' },
    adminSecretKey: 'SSECRET',
  };

  beforeEach(async () => {
    mockTx = { sign: jest.fn() };
    mockContractInstance = { call: jest.fn().mockReturnValue('mock-op') };
    mockKeypair = { publicKey: jest.fn().mockReturnValue('GADMIN...') };
    mockRpcInstance = {
      getAccount: jest.fn().mockResolvedValue({}),
      simulateTransaction: jest.fn().mockResolvedValue({ result: { retval: 'mock-retval' } }),
      sendTransaction: jest.fn().mockResolvedValue({ hash: 'TXHASH123' }),
    };

    (StellarSdk.rpc.Server as jest.Mock).mockImplementation(() => mockRpcInstance);
    (StellarSdk.Contract as jest.Mock).mockImplementation(() => mockContractInstance);
    (StellarSdk.TransactionBuilder as jest.Mock).mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn().mockReturnValue(mockTx),
    }));
    (StellarSdk.Keypair.fromSecret as jest.Mock).mockReturnValue(mockKeypair);
    (StellarSdk.Address.fromString as jest.Mock).mockReturnValue({
      toScVal: jest.fn().mockReturnValue('mock-scval'),
    });
    (StellarSdk.rpc.assembleTransaction as jest.Mock).mockReturnValue({
      build: jest.fn().mockReturnValue(mockTx),
    });
    (StellarSdk.nativeToScVal as jest.Mock).mockReturnValue('mock-i128');
    (StellarSdk.scValToNative as jest.Mock).mockReturnValue(BigInt(1000));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokensService,
        { provide: sorobanConfig.KEY, useValue: defaultConfig },
      ],
    }).compile();

    service = module.get(TokensService);
    service.onModuleInit();
  });

  afterEach(() => jest.clearAllMocks());

  it('initializes the Stellar RPC server on module init', () => {
    expect(StellarSdk.rpc.Server).toHaveBeenCalledWith('https://rpc.test');
    expect((service as any).rpc).toBeDefined();
    expect((service as any).networkPassphrase).toBe('Test Network');
  });

  describe('mintTokens', () => {
    it('returns an error when mint contract id is missing', async () => {
      const module = await Test.createTestingModule({
        providers: [
          TokensService,
          {
            provide: sorobanConfig.KEY,
            useValue: { ...defaultConfig, contracts: { tokenMint: '', tokenSale: 'sale-contract' } },
          },
        ],
      }).compile();
      const svc = module.get(TokensService);

      await expect(svc.mintTokens('GDEST', '100')).resolves.toEqual({
        error: 'Contract ID not configured',
      });
    });

    it('builds, signs, and submits the mint transaction', async () => {
      const result = await service.mintTokens('GDEST', '100');

      expect(StellarSdk.Keypair.fromSecret).toHaveBeenCalledWith('SSECRET');
      expect(mockRpcInstance.getAccount).toHaveBeenCalledWith('GADMIN...');
      expect(StellarSdk.Contract).toHaveBeenCalledWith('mint-contract');
      expect(mockContractInstance.call).toHaveBeenCalledWith('mint', 'mock-scval', 'mock-i128');
      expect(mockRpcInstance.simulateTransaction).toHaveBeenCalledWith(mockTx);
      expect(StellarSdk.rpc.assembleTransaction).toHaveBeenCalledWith(
        mockTx,
        { result: { retval: 'mock-retval' } },
      );
      expect(mockTx.sign).toHaveBeenCalledWith(mockKeypair);
      expect(mockRpcInstance.sendTransaction).toHaveBeenCalledWith(mockTx);
      expect(result).toEqual({
        status: 'submitted',
        hash: 'TXHASH123',
        contractId: 'mint-contract',
        operation: 'mint',
        to: 'GDEST',
        amount: '100',
      });
    });
  });

  describe('sellTokens', () => {
    it('returns an error when sell contract id is missing', async () => {
      const module = await Test.createTestingModule({
        providers: [
          TokensService,
          {
            provide: sorobanConfig.KEY,
            useValue: {
              ...defaultConfig,
              contracts: { tokenMint: 'mint-contract', tokenSale: 'PLACEHOLDER_SALE' },
            },
          },
        ],
      }).compile();
      const svc = module.get(TokensService);

      await expect(svc.sellTokens('GSELLER', '10', '2')).resolves.toEqual({
        error: 'Contract ID not configured',
      });
    });

    it('builds, signs, and submits the sell transaction', async () => {
      const result = await service.sellTokens('GSELLER', '10', '2');

      expect(StellarSdk.Keypair.fromSecret).toHaveBeenCalledWith('SSECRET');
      expect(mockRpcInstance.getAccount).toHaveBeenCalledWith('GADMIN...');
      expect(StellarSdk.Contract).toHaveBeenCalledWith('sale-contract');
      expect(mockContractInstance.call).toHaveBeenCalledWith(
        'sell',
        'mock-scval',
        'mock-i128',
        'mock-i128',
      );
      expect(mockRpcInstance.simulateTransaction).toHaveBeenCalled();
      expect(mockTx.sign).toHaveBeenCalledWith(mockKeypair);
      expect(mockRpcInstance.sendTransaction).toHaveBeenCalled();
      expect(result).toEqual({
        status: 'submitted',
        hash: 'TXHASH123',
        contractId: 'sale-contract',
        operation: 'sell',
        seller: 'GSELLER',
        amount: '10',
        price: '2',
      });
    });
  });

  describe('getBalance', () => {
    it('returns an error when mint contract id is missing', async () => {
      const module = await Test.createTestingModule({
        providers: [
          TokensService,
          {
            provide: sorobanConfig.KEY,
            useValue: { ...defaultConfig, contracts: { tokenMint: '', tokenSale: 'sale-contract' } },
          },
        ],
      }).compile();
      const svc = module.get(TokensService);

      await expect(svc.getBalance('GADDR')).resolves.toEqual({
        error: 'Contract ID not configured',
      });
    });

    it('simulates the balance call and returns the parsed value', async () => {
      const result = await service.getBalance('GADDR');

      expect(StellarSdk.Contract).toHaveBeenCalledWith('mint-contract');
      expect(mockContractInstance.call).toHaveBeenCalledWith('balance', 'mock-scval');
      expect(mockRpcInstance.simulateTransaction).toHaveBeenCalled();
      expect(StellarSdk.scValToNative).toHaveBeenCalledWith('mock-retval');
      expect(result).toEqual({ address: 'GADDR', balance: '1000' });
    });

    it('does not call sendTransaction for balance queries', async () => {
      await service.getBalance('GADDR');

      expect(mockRpcInstance.sendTransaction).not.toHaveBeenCalled();
      expect(StellarSdk.rpc.assembleTransaction).not.toHaveBeenCalled();
    });

    it('returns zero balance when simulation result has no retval', async () => {
      mockRpcInstance.simulateTransaction.mockResolvedValueOnce({ result: null });

      const result = await service.getBalance('GADDR');

      expect(result).toEqual({ address: 'GADDR', balance: '0' });
    });
  });
});
