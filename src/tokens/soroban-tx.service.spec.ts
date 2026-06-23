import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { rpc } from '@stellar/stellar-sdk';
import { sorobanConfig } from './config/soroban.config';
import { SorobanSigningService } from './soroban-signing.service';
import { SorobanTxService } from './soroban-tx.service';

jest.mock('@stellar/stellar-sdk', () => ({
  BASE_FEE: '100',
  xdr: {},
  Contract: jest.fn().mockImplementation(() => ({
    call: jest.fn().mockReturnValue({ __op: true }),
  })),
  TransactionBuilder: jest.fn().mockImplementation(() => ({
    addOperation: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({ __tx: true }),
  })),
  rpc: {
    Server: jest.fn(),
    Api: {
      GetTransactionStatus: { NOT_FOUND: 'NOT_FOUND', SUCCESS: 'SUCCESS', FAILED: 'FAILED' },
    },
  },
}));

describe('SorobanTxService', () => {
  const rpcServerMock = rpc.Server as unknown as jest.Mock;
  let rpcInstance: {
    getAccount: jest.Mock;
    prepareTransaction: jest.Mock;
    sendTransaction: jest.Mock;
    getTransaction: jest.Mock;
  };
  let signing: { getAdminPublicKey: jest.Mock; signTransaction: jest.Mock };
  let service: SorobanTxService;

  beforeEach(async () => {
    rpcInstance = {
      getAccount: jest.fn().mockResolvedValue({ __account: true }),
      prepareTransaction: jest.fn().mockResolvedValue({ __prepared: true }),
      sendTransaction: jest.fn().mockResolvedValue({ status: 'PENDING', hash: 'HASH' }),
      getTransaction: jest.fn().mockResolvedValue({ status: 'SUCCESS' }),
    };
    rpcServerMock.mockClear();
    rpcServerMock.mockImplementation(() => rpcInstance);

    signing = {
      getAdminPublicKey: jest.fn().mockReturnValue('GADMIN'),
      signTransaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SorobanTxService,
        {
          provide: sorobanConfig.KEY,
          useValue: { rpcUrl: 'https://rpc.test', networkPassphrase: 'Test Network' },
        },
        { provide: SorobanSigningService, useValue: signing },
      ],
    }).compile();

    service = module.get(SorobanTxService);
    service.onModuleInit();
  });

  afterEach(() => jest.clearAllMocks());

  it('builds, signs and submits a contract invocation', async () => {
    const result = await service.invokeContract({ contractId: 'C123', method: 'mint', args: [] });

    expect(rpcInstance.getAccount).toHaveBeenCalledWith('GADMIN');
    expect(rpcInstance.prepareTransaction).toHaveBeenCalledWith({ __tx: true });
    expect(signing.signTransaction).toHaveBeenCalledWith({ __prepared: true });
    expect(rpcInstance.sendTransaction).toHaveBeenCalledWith({ __prepared: true });
    expect(result).toEqual({ hash: 'HASH', status: 'SUCCESS' });
  });

  it('throws when submission returns an error', async () => {
    rpcInstance.sendTransaction.mockResolvedValue({ status: 'ERROR', hash: 'HASH', errorResult: {} });

    await expect(
      service.invokeContract({ contractId: 'C123', method: 'mint', args: [] }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(rpcInstance.getTransaction).not.toHaveBeenCalled();
  });

  it('throws when the transaction does not reach SUCCESS', async () => {
    rpcInstance.getTransaction.mockResolvedValue({ status: 'FAILED' });

    await expect(
      service.invokeContract({ contractId: 'C123', method: 'mint', args: [] }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
