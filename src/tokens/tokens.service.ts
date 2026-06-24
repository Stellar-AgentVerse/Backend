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
    this.logger.log(`Conectado a Stellar RPC: ${this.config.rpcUrl}`);
  }

  private validateIntegerString(value: string, field: string): void {
    if (!/^-?\d+$/.test(value)) {
      throw new Error(`${field} must be a valid integer string, got: "${value}"`);
    }
  }

  private async awaitTransaction(hash: string): Promise<{ hash: string; finalStatus: string }> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      const tx = await this.rpc.getTransaction(hash);
      if (tx.status !== 'NOT_FOUND') {
        return { hash, finalStatus: tx.status };
      }
      await new Promise<void>(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    throw new Error(`Transaction ${hash} timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS}ms`);
  }

  private async submitContractCall(
    contractId: string,
    fnName: string,
    args: StellarSdk.xdr.ScVal[],
  ): Promise<{ hash: string; finalStatus: string }> {
    const adminKeypair = StellarSdk.Keypair.fromSecret(this.config.adminSecretKey);
    const account = await this.rpc.getAccount(adminKeypair.publicKey());

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
    assembled.sign(adminKeypair);
    const { hash } = await this.rpc.sendTransaction(assembled);
    return this.awaitTransaction(hash);
  }

  async mintTokens(to: string, amount: string) {
    const contractId = this.config.contracts.tokenMint;

    if (!contractId || contractId.includes('PLACEHOLDER')) {
      this.logger.warn(`El ID del contrato de Mint 'tokenMint' no está configurado.`);
      return { error: 'Contract ID not configured' };
    }

    try {
      this.validateIntegerString(amount, 'amount');
      this.logger.log(`Invocando Contrato Mint (${contractId}) -> mint(to: ${to}, amount: ${amount})`);

      const { hash, finalStatus } = await this.submitContractCall(contractId, 'mint', [
        StellarSdk.Address.fromString(to).toScVal(),
        StellarSdk.nativeToScVal(BigInt(amount), { type: 'i128' }),
      ]);

      return { status: finalStatus, hash, contractId, operation: 'mint', to, amount };
    } catch (err) {
      this.logger.error(`mintTokens failed: ${(err as Error).message}`, (err as Error).stack);
      return { error: 'mintTokens failed', details: (err as Error).message };
    }
  }

  async sellTokens(seller: string, amount: string, price: string) {
    const contractId = this.config.contracts.tokenSale;

    if (!contractId || contractId.includes('PLACEHOLDER')) {
      this.logger.warn(`El ID del contrato de Venta 'tokenSale' no está configurado.`);
      return { error: 'Contract ID not configured' };
    }

    try {
      this.validateIntegerString(amount, 'amount');
      this.validateIntegerString(price, 'price');
      this.logger.log(`Invocando Contrato Venta (${contractId}) -> sell(seller: ${seller}, amount: ${amount}, price: ${price})`);

      const { hash, finalStatus } = await this.submitContractCall(contractId, 'sell', [
        StellarSdk.Address.fromString(seller).toScVal(),
        StellarSdk.nativeToScVal(BigInt(amount), { type: 'i128' }),
        StellarSdk.nativeToScVal(BigInt(price), { type: 'i128' }),
      ]);

      return { status: finalStatus, hash, contractId, operation: 'sell', seller, amount, price };
    } catch (err) {
      this.logger.error(`sellTokens failed: ${(err as Error).message}`, (err as Error).stack);
      return { error: 'sellTokens failed', details: (err as Error).message };
    }
  }

  async getBalance(address: string) {
    const contractId = this.config.contracts.tokenMint;

    if (!contractId || contractId.includes('PLACEHOLDER')) {
      this.logger.warn(`El ID del contrato de Mint 'tokenMint' no está configurado.`);
      return { error: 'Contract ID not configured' };
    }

    try {
      const adminKeypair = StellarSdk.Keypair.fromSecret(this.config.adminSecretKey);
      const account = await this.rpc.getAccount(adminKeypair.publicKey());

      const contract = new StellarSdk.Contract(contractId);
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(contract.call('balance', StellarSdk.Address.fromString(address).toScVal()))
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
      this.logger.error(`getBalance failed: ${(err as Error).message}`, (err as Error).stack);
      return { error: 'getBalance failed', details: (err as Error).message };
    }
  }
}
