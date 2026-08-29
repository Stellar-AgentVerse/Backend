/* eslint-disable @typescript-eslint/unbound-method --
 * `expect(mock.method)` passes a method reference to a jest matcher, which is a
 * documented false positive for this rule. The alternative is restructuring the
 * assertions around a linter limitation rather than around what they verify.
 */
import { NotImplementedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import type { JwtPayload } from '../auth/common/interfaces/jwt-payload.interface';
import { CREDIT_PURCHASE_NOT_AVAILABLE } from './wallet.capabilities';

const CALLER: JwtPayload = {
  publicKey: 'GBWALLETUNITTEST',
  iat: Math.floor(Date.now() / 1000),
};

describe('WalletController', () => {
  let controller: WalletController;
  let walletService: jest.Mocked<WalletService>;

  beforeEach(async () => {
    const walletServiceMock = {
      getBalance: jest.fn(),
      getPackages: jest.fn(),
      getTransactions: jest.fn(),
    } as unknown as jest.Mocked<WalletService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [{ provide: WalletService, useValue: walletServiceMock }],
    }).compile();

    controller = module.get(WalletController);
    walletService = module.get(WalletService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('scopes the balance to the authenticated principal', async () => {
    const balance = { credits: 0 };
    walletService.getBalance.mockResolvedValue(balance as never);

    await expect(controller.getBalance(CALLER)).resolves.toEqual(balance);
    expect(walletService.getBalance).toHaveBeenCalledWith(CALLER.publicKey);
  });

  it('scopes transactions to the authenticated principal', async () => {
    const txs = [{ id: 'tx-1' }];
    walletService.getTransactions.mockResolvedValue(txs as never);

    await expect(controller.getTransactions(CALLER)).resolves.toEqual(txs);
    // Paging values are forwarded unchanged; the service sanitises them, so a
    // hostile ?limit=abc cannot reach the query builder as NaN.
    expect(walletService.getTransactions).toHaveBeenCalledWith(
      CALLER.publicKey,
      undefined,
      undefined,
    );
  });

  it('forwards explicit paging', async () => {
    walletService.getTransactions.mockResolvedValue([] as never);

    await controller.getTransactions(CALLER, 5, 10);

    expect(walletService.getTransactions).toHaveBeenCalledWith(
      CALLER.publicKey,
      5,
      10,
    );
  });

  it('takes no wallet identifier from the request in any signature', () => {
    // Structural guarantee behind acceptance criterion 1: if no handler accepts
    // an identity argument, no request can name another wallet. getBalance and
    // getTransactions receive the principal first and nothing else identifying;
    // purchase takes no arguments at all.
    expect(controller.getBalance).toHaveLength(1);
    expect(controller.purchase).toHaveLength(0);
    expect(controller.getPackages).toHaveLength(0);
  });

  it('delegates getPackages to WalletService', async () => {
    const packages = { purchase: { supported: false }, packages: [] };
    walletService.getPackages.mockResolvedValue(packages as never);

    await expect(controller.getPackages()).resolves.toEqual(packages);
    expect(walletService.getPackages).toHaveBeenCalledTimes(1);
  });

  it('refuses credit package purchase with 501 and a stable reason code', () => {
    expect(() => controller.purchase()).toThrow(NotImplementedException);

    try {
      controller.purchase();
    } catch (err) {
      const exception = err as NotImplementedException;
      expect(exception.getStatus()).toBe(501);
      expect(exception.message).toBe(CREDIT_PURCHASE_NOT_AVAILABLE);
    }
  });

  it('exposes no way to mutate a wallet balance', () => {
    // purchasePackage was the only balance mutation and has been removed from
    // the service entirely, so it cannot be reintroduced by a controller edit.
    expect(
      (walletService as unknown as Record<string, unknown>).purchasePackage,
    ).toBeUndefined();
    expect(
      (WalletService.prototype as unknown as Record<string, unknown>)
        .purchasePackage,
    ).toBeUndefined();
  });
});
