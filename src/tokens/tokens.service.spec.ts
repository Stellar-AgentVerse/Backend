import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { sorobanConfig } from './config/soroban.config';
import { SorobanTxService } from './soroban-tx.service';
import { TokensService } from './tokens.service';

const VALID_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 1));
const RECIPIENT = Keypair.random().publicKey();

describe('TokensService', () => {
  let service: TokensService;
  let invokeContract: jest.Mock;

  async function buildService(contracts: { tokenMint: string; tokenSale: string }) {
    invokeContract = jest.fn().mockResolvedValue({ hash: 'TXHASH', status: 'SUCCESS' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokensService,
        {
          provide: sorobanConfig.KEY,
          useValue: { contracts },
        },
        {
          provide: SorobanTxService,
          useValue: { invokeContract },
        },
      ],
    }).compile();

    return module.get(TokensService);
  }

  beforeEach(async () => {
    service = await buildService({
      tokenMint: VALID_CONTRACT_ID,
      tokenSale: VALID_CONTRACT_ID,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('mints tokens via an admin-signed contract invocation', async () => {
    const result = await service.mintTokens(RECIPIENT, '100');

    expect(invokeContract).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: VALID_CONTRACT_ID, method: 'mint' }),
    );
    expect(invokeContract.mock.calls[0][0].args).toHaveLength(2);
    expect(result).toEqual({
      hash: 'TXHASH',
      status: 'SUCCESS',
      operation: 'mint',
      to: RECIPIENT,
      amount: '100',
    });
  });

  it('sells tokens via an admin-signed contract invocation', async () => {
    const result = await service.sellTokens(RECIPIENT, '10', '2');

    expect(invokeContract).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: VALID_CONTRACT_ID, method: 'sell' }),
    );
    expect(invokeContract.mock.calls[0][0].args).toHaveLength(3);
    expect(result).toEqual({
      hash: 'TXHASH',
      status: 'SUCCESS',
      operation: 'sell',
      seller: RECIPIENT,
      amount: '10',
      price: '2',
    });
  });

  it('rejects mint when the mint contract id is not configured', async () => {
    const unconfigured = await buildService({ tokenMint: '', tokenSale: VALID_CONTRACT_ID });

    await expect(unconfigured.mintTokens(RECIPIENT, '100')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(invokeContract).not.toHaveBeenCalled();
  });

  it('rejects sell when the sale contract id is invalid', async () => {
    const unconfigured = await buildService({ tokenMint: VALID_CONTRACT_ID, tokenSale: 'PLACEHOLDER' });

    await expect(unconfigured.sellTokens(RECIPIENT, '10', '2')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(invokeContract).not.toHaveBeenCalled();
  });
});
