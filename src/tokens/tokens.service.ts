import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { sorobanConfig } from './config/soroban.config';
import * as StellarSdk from '@stellar/stellar-sdk';

const MAX_POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 1500;

@Injectable()
export class TokensService implements OnModuleInit {
  private readonly logger = new Logger(TokensService.name);
  private rpc!: StellarSdk.rpc.Server;
  private networkPassphrase!: string;
  private adminKeypair!: StellarSdk.Keypair;

  constructor(
    @Inject(sorobanConfig.KEY)
    private config: {
      network: string;
      rpcUrl: string;
      networkPassphrase: string;
      contracts: { tokenMint: string; tokenSale: string };
      adminSecretKey: string;
    },
  ) {}

  onModuleInit() {
    this.rpc = new StellarSdk.rpc.Server(this.config.rpcUrl);
    this.networkPassphrase = this.config.networkPassphrase;
    this.validateConfig();
    this.adminKeypair = StellarSdk.Keypair.fromSecret(
      this.config.adminSecretKey,
    );
    this.logger.log(`Connected to Stellar RPC: ${this.config.rpcUrl}`);
  }

  private validateConfig(): void {
    const missing: string[] = [];

    if (!this.config.adminSecretKey) {
      missing.push('STELLAR_ADMIN_SECRET_KEY');
    }

    if (
      !this.config.contracts.tokenMint ||
      this.config.contracts.tokenMint.includes('PLACEHOLDER')
    ) {
      missing.push('SOROBAN_TOKEN_MINT_CONTRACT_ID');
    }

    if (
      !this.config.contracts.tokenSale ||
      this.config.contracts.tokenSale.includes('PLACEHOLDER')
    ) {
      missing.push('SOROBAN_TOKEN_SALE_CONTRACT_ID');
    }

    if (missing.length > 0) {
      this.logger.warn(
        `Token operations unavailable: ${missing.join(', ')} not configured`,
      );
    }
  }

  private validateIntegerString(value: string, field: string): void {
    if (!/^-?\d+$/.test(value)) {
      throw new Error(
        `${field} must be a valid integer string, got: "${value}"`,
      );
    }
  }

  private async awaitTransaction(
    hash: string,
  ): Promise<{ hash: string; finalStatus: string }> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      const tx = await this.rpc.getTransaction(hash);
      if (tx.status !== 'NOT_FOUND') {
        return { hash, finalStatus: tx.status };
      }
      await new Promise<void>((resolve) =>
        setTimeout(resolve, POLL_INTERVAL_MS),
      );
    }
    throw new Error(
      `Transaction ${hash} timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS}ms`,
    );
  }

  private async submitContractCall(
    contractId: string,
    fnName: string,
    args: StellarSdk.xdr.ScVal[],
  ): Promise<{ hash: string; finalStatus: string }> {
    const account = await this.rpc.getAccount(this.adminKeypair.publicKey());

    const contract = new StellarSdk.Contract(contractId);
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(fnName, ...args))
      .setTimeout(30)
      .build();

    const simResult = await this.rpc.simulateTransaction(tx);
    const assembled = StellarSdk.rpc.assembleTransaction(tx, simResult).build();
    assembled.sign(this.adminKeypair);
    const sendResponse = await this.rpc.sendTransaction(assembled);
    if (
      sendResponse.status === 'ERROR' ||
      sendResponse.status === 'TRY_AGAIN_LATER'
    ) {
      throw new Error(`sendTransaction failed: ${sendResponse.status}`);
    }
    return this.awaitTransaction(sendResponse.hash);
  }

  private validateContractId(
    id: string | undefined,
    label: string,
  ): id is string {
    if (!id || id.includes('PLACEHOLDER')) {
      this.logger.warn(`Contract '${label}' not configured`);
      return false;
    }
    return true;
  }

  async mintTokens(to: string, amount: string) {
    if (
      !this.validateContractId(this.config.contracts.tokenMint, 'tokenMint')
    ) {
      return { error: 'Contract ID not configured' };
    }

    try {
      this.validateIntegerString(amount, 'amount');
      this.logger.log(
        `Invoking Mint Contract (${this.config.contracts.tokenMint}) -> mint(to: ${to}, amount: ${amount})`,
      );

      const { hash, finalStatus } = await this.submitContractCall(
        this.config.contracts.tokenMint,
        'mint',
        [
          StellarSdk.Address.fromString(to).toScVal(),
          StellarSdk.nativeToScVal(BigInt(amount), { type: 'i128' }),
        ],
      );

      return {
        status: finalStatus,
        hash,
        contractId: this.config.contracts.tokenMint,
        operation: 'mint',
        to,
        amount,
      };
    } catch (err) {
      this.logger.error(
        `mintTokens failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return { error: 'mintTokens failed', details: (err as Error).message };
    }
  }

  async sellTokens(seller: string, amount: string, price: string) {
    if (
      !this.validateContractId(this.config.contracts.tokenSale, 'tokenSale')
    ) {
      return { error: 'Contract ID not configured' };
    }

    try {
      this.validateIntegerString(amount, 'amount');
      this.validateIntegerString(price, 'price');
      this.logger.log(
        `Invoking Sale Contract (${this.config.contracts.tokenSale}) -> sell(seller: ${seller}, amount: ${amount}, price: ${price})`,
      );

      const { hash, finalStatus } = await this.submitContractCall(
        this.config.contracts.tokenSale,
        'sell',
        [
          StellarSdk.Address.fromString(seller).toScVal(),
          StellarSdk.nativeToScVal(BigInt(amount), { type: 'i128' }),
          StellarSdk.nativeToScVal(BigInt(price), { type: 'i128' }),
        ],
      );

      return {
        status: finalStatus,
        hash,
        contractId: this.config.contracts.tokenSale,
        operation: 'sell',
        seller,
        amount,
        price,
      };
    } catch (err) {
      this.logger.error(
        `sellTokens failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return { error: 'sellTokens failed', details: (err as Error).message };
    }
  }

  async getBalance(address: string) {
    if (
      !this.validateContractId(this.config.contracts.tokenMint, 'tokenMint')
    ) {
      return { error: 'Contract ID not configured' };
    }

    try {
      const account = await this.rpc.getAccount(this.adminKeypair.publicKey());

      const contract = new StellarSdk.Contract(this.config.contracts.tokenMint);
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'balance',
            StellarSdk.Address.fromString(address).toScVal(),
          ),
        )
        .setTimeout(30)
        .build();

      const simResult = await this.rpc.simulateTransaction(tx);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const retval = (simResult as any).result?.retval;

      if (!retval) {
        return { address, balance: '0' };
      }

      const balance = StellarSdk.scValToNative(retval);
      return { address, balance: balance.toString() };
    } catch (err) {
      this.logger.error(
        `getBalance failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return { error: 'getBalance failed', details: (err as Error).message };
    }
  }
}
