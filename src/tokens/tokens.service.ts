import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { sorobanConfig } from './config/soroban.config';
import * as StellarSdk from '@stellar/stellar-sdk';

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

  async mintTokens(to: string, amount: string) {
    const contractId = this.config.contracts.tokenMint;

    if (!contractId || contractId.includes('PLACEHOLDER')) {
      this.logger.warn(`El ID del contrato de Mint 'tokenMint' no está configurado.`);
      return { error: 'Contract ID not configured' };
    }

    this.logger.log(`Invocando Contrato Mint (${contractId}) -> mint(to: ${to}, amount: ${amount})`);

    const adminKeypair = StellarSdk.Keypair.fromSecret(this.config.adminSecretKey);
    const account = await this.rpc.getAccount(adminKeypair.publicKey());

    const contract = new StellarSdk.Contract(contractId);
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'mint',
          StellarSdk.Address.fromString(to).toScVal(),
          StellarSdk.nativeToScVal(BigInt(amount), { type: 'i128' }),
        ),
      )
      .setTimeout(30)
      .build();

    const simResult = await this.rpc.simulateTransaction(tx);
    const assembled = StellarSdk.rpc.assembleTransaction(tx, simResult).build();
    assembled.sign(adminKeypair);
    const sendResult = await this.rpc.sendTransaction(assembled);

    return {
      status: 'submitted',
      hash: sendResult.hash,
      contractId,
      operation: 'mint',
      to,
      amount,
    };
  }

  async sellTokens(seller: string, amount: string, price: string) {
    const contractId = this.config.contracts.tokenSale;

    if (!contractId || contractId.includes('PLACEHOLDER')) {
      this.logger.warn(`El ID del contrato de Venta 'tokenSale' no está configurado.`);
      return { error: 'Contract ID not configured' };
    }

    this.logger.log(`Invocando Contrato Venta (${contractId}) -> sell(seller: ${seller}, amount: ${amount}, price: ${price})`);

    const adminKeypair = StellarSdk.Keypair.fromSecret(this.config.adminSecretKey);
    const account = await this.rpc.getAccount(adminKeypair.publicKey());

    const contract = new StellarSdk.Contract(contractId);
    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(
        contract.call(
          'sell',
          StellarSdk.Address.fromString(seller).toScVal(),
          StellarSdk.nativeToScVal(BigInt(amount), { type: 'i128' }),
          StellarSdk.nativeToScVal(BigInt(price), { type: 'i128' }),
        ),
      )
      .setTimeout(30)
      .build();

    const simResult = await this.rpc.simulateTransaction(tx);
    const assembled = StellarSdk.rpc.assembleTransaction(tx, simResult).build();
    assembled.sign(adminKeypair);
    const sendResult = await this.rpc.sendTransaction(assembled);

    return {
      status: 'submitted',
      hash: sendResult.hash,
      contractId,
      operation: 'sell',
      seller,
      amount,
      price,
    };
  }

  async getBalance(address: string) {
    const contractId = this.config.contracts.tokenMint;

    if (!contractId || contractId.includes('PLACEHOLDER')) {
      this.logger.warn(`El ID del contrato de Mint 'tokenMint' no está configurado.`);
      return { error: 'Contract ID not configured' };
    }

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
    // result only exists on success responses; error responses use a different branch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retval = (simResult as any).result?.retval;

    if (!retval) {
      return { address, balance: '0' };
    }

    const balance = StellarSdk.scValToNative(retval);
    return { address, balance: balance.toString() };
  }
}
