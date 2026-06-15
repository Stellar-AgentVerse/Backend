import { Test, TestingModule } from '@nestjs/testing';
import * as StellarSdk from '@stellar/stellar-sdk';
import { sorobanConfig } from './config/soroban.config';
import { TokensService } from './tokens.service';

jest.mock('@stellar/stellar-sdk', () => ({
  rpc: {
    Server: jest.fn(),
  },
}));

describe('TokensService', () => {
  let service: TokensService;
  const rpcServerMock = StellarSdk.rpc.Server as jest.Mock;

  beforeEach(async () => {
    rpcServerMock.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokensService,
        {
          provide: sorobanConfig.KEY,
          useValue: {
            network: 'testnet',
            rpcUrl: 'https://rpc.test',
            networkPassphrase: 'Test Network',
            contracts: {
              tokenMint: 'mint-contract',
              tokenSale: 'sale-contract',
            },
            adminSecretKey: 'SSECRET',
          },
        },
      ],
    }).compile();

    service = module.get(TokensService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('initializes the Stellar RPC server on module init', () => {
    service.onModuleInit();

    expect(rpcServerMock).toHaveBeenCalledWith('https://rpc.test');
    expect((service as any).rpc).toBeDefined();
    expect((service as any).networkPassphrase).toBe('Test Network');
  });

  it('returns an error when mint contract id is missing', async () => {
    const module = await Test.createTestingModule({
      providers: [
        TokensService,
        {
          provide: sorobanConfig.KEY,
          useValue: {
            network: 'testnet',
            rpcUrl: 'https://rpc.test',
            networkPassphrase: 'Test Network',
            contracts: { tokenMint: '', tokenSale: 'sale-contract' },
            adminSecretKey: 'SSECRET',
          },
        },
      ],
    }).compile();
    const missingMintService = module.get(TokensService);

    await expect(missingMintService.mintTokens('GDEST', '100')).resolves.toEqual({
      error: 'Contract ID not configured',
    });
  });

  it('simulates mint success when contract id is configured', async () => {
    service.onModuleInit();

    await expect(service.mintTokens('GDEST', '100')).resolves.toEqual({
      status: 'simulated_success',
      contractId: 'mint-contract',
      operation: 'mint',
      to: 'GDEST',
      amount: '100',
    });
  });

  it('returns an error when sell contract id is missing', async () => {
    const module = await Test.createTestingModule({
      providers: [
        TokensService,
        {
          provide: sorobanConfig.KEY,
          useValue: {
            network: 'testnet',
            rpcUrl: 'https://rpc.test',
            networkPassphrase: 'Test Network',
            contracts: { tokenMint: 'mint-contract', tokenSale: 'PLACEHOLDER_SALE' },
            adminSecretKey: 'SSECRET',
          },
        },
      ],
    }).compile();
    const missingSaleService = module.get(TokensService);

    await expect(missingSaleService.sellTokens('GSELLER', '10', '2')).resolves.toEqual({
      error: 'Contract ID not configured',
    });
  });

  it('simulates sell success when contract id is configured', async () => {
    service.onModuleInit();

    await expect(service.sellTokens('GSELLER', '10', '2')).resolves.toEqual({
      status: 'simulated_success',
      contractId: 'sale-contract',
      operation: 'sell',
      seller: 'GSELLER',
      amount: '10',
      price: '2',
    });
  });
});
