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
    getTransaction: jest.Mock;
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
      getTransaction: jest.fn().mockResolvedValue({ status: 'SUCCESS' }),
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

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

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

    it('builds, signs, submits, and polls the mint transaction', async () => {
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
      expect(mockRpcInstance.getTransaction).toHaveBeenCalledWith('TXHASH123');
      expect(result).toEqual({
        status: 'SUCCESS',
        hash: 'TXHASH123',
        contractId: 'mint-contract',
        operation: 'mint',
        to: 'GDEST',
        amount: '100',
      });
    });

    it('polls getTransaction until status is not NOT_FOUND', async () => {
      mockRpcInstance.getTransaction
        .mockResolvedValueOnce({ status: 'NOT_FOUND' })
        .mockResolvedValueOnce({ status: 'NOT_FOUND' })
        .mockResolvedValueOnce({ status: 'SUCCESS' });

      jest.useFakeTimers();
      const promise = service.mintTokens('GDEST', '100');
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(mockRpcInstance.getTransaction).toHaveBeenCalledTimes(3);
      expect(result).toMatchObject({ status: 'SUCCESS', hash: 'TXHASH123' });
    });

    it('returns error when awaitTransaction times out after max attempts', async () => {
      mockRpcInstance.getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });

      jest.useFakeTimers();
      const promise = service.mintTokens('GDEST', '100');
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toMatchObject({
        error: 'mintTokens failed',
        details: expect.stringContaining('timed out'),
      });
    });

    it('returns error when getAccount throws', async () => {
      mockRpcInstance.getAccount.mockRejectedValueOnce(new Error('network timeout'));

      const result = await service.mintTokens('GDEST', '100');

      expect(result).toEqual({ error: 'mintTokens failed', details: 'network timeout' });
    });

    it('returns error when simulateTransaction throws', async () => {
      mockRpcInstance.simulateTransaction.mockRejectedValueOnce(new Error('simulation failed'));

      const result = await service.mintTokens('GDEST', '100');

      expect(result).toEqual({ error: 'mintTokens failed', details: 'simulation failed' });
    });

    it('returns error when sendTransaction throws', async () => {
      mockRpcInstance.sendTransaction.mockRejectedValueOnce(new Error('RPC unavailable'));

      const result = await service.mintTokens('GDEST', '100');

      expect(result).toEqual({ error: 'mintTokens failed', details: 'RPC unavailable' });
    });

    it('returns error when amount is not a valid integer string', async () => {
      const result = await service.mintTokens('GDEST', '1.5');

      expect(result).toMatchObject({
        error: 'mintTokens failed',
        details: expect.stringContaining('amount'),
      });
      expect(mockRpcInstance.getAccount).not.toHaveBeenCalled();
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

    it('builds, signs, submits, and polls the sell transaction', async () => {
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
      expect(mockRpcInstance.getTransaction).toHaveBeenCalledWith('TXHASH123');
      expect(result).toEqual({
        status: 'SUCCESS',
        hash: 'TXHASH123',
        contractId: 'sale-contract',
        operation: 'sell',
        seller: 'GSELLER',
        amount: '10',
        price: '2',
      });
    });

    it('returns error when RPC call fails', async () => {
      mockRpcInstance.getAccount.mockRejectedValueOnce(new Error('connection refused'));

      const result = await service.sellTokens('GSELLER', '10', '2');

      expect(result).toEqual({ error: 'sellTokens failed', details: 'connection refused' });
    });

    it('returns error when amount is not a valid integer string', async () => {
      const result = await service.sellTokens('GSELLER', 'abc', '2');

      expect(result).toMatchObject({
        error: 'sellTokens failed',
        details: expect.stringContaining('amount'),
      });
      expect(mockRpcInstance.getAccount).not.toHaveBeenCalled();
    });

    it('returns error when price is not a valid integer string', async () => {
      const result = await service.sellTokens('GSELLER', '10', '2.5');

      expect(result).toMatchObject({
        error: 'sellTokens failed',
        details: expect.stringContaining('price'),
      });
      expect(mockRpcInstance.getAccount).not.toHaveBeenCalled();
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

    it('returns error when getAccount throws', async () => {
      mockRpcInstance.getAccount.mockRejectedValueOnce(new Error('network timeout'));

      const result = await service.getBalance('GADDR');

      expect(result).toEqual({ error: 'getBalance failed', details: 'network timeout' });
    });

    it('returns error when simulateTransaction throws', async () => {
      mockRpcInstance.simulateTransaction.mockRejectedValueOnce(new Error('invalid contract'));

      const result = await service.getBalance('GADDR');

      expect(result).toEqual({ error: 'getBalance failed', details: 'invalid contract' });
    });
  });
});
