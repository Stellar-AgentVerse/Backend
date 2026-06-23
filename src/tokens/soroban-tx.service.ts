import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import {
  BASE_FEE,
  Contract,
  TransactionBuilder,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import { sorobanConfig } from './config/soroban.config';
import { SorobanSigningService } from './soroban-signing.service';

export interface InvokeContractParams {
  contractId: string;
  method: string;
  args: xdr.ScVal[];
}

export interface InvokeContractResult {
  hash: string;
  status: string;
}

const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 30;

/**
 * Generic admin-signed Soroban contract invocation: build -> simulate/assemble
 * -> sign with the admin keypair -> submit -> poll until the transaction reaches
 * a terminal state. Shared by every token operation.
 */
@Injectable()
export class SorobanTxService implements OnModuleInit {
  private readonly logger = new Logger(SorobanTxService.name);
  private rpcServer: rpc.Server;

  constructor(
    @Inject(sorobanConfig.KEY)
    private readonly config: { rpcUrl: string; networkPassphrase: string },
    private readonly signing: SorobanSigningService,
  ) {}

  onModuleInit() {
    this.rpcServer = new rpc.Server(this.config.rpcUrl);
    this.logger.log(`Conectado a Stellar RPC: ${this.config.rpcUrl}`);
  }

  async invokeContract({ contractId, method, args }: InvokeContractParams): Promise<InvokeContractResult> {
    const adminPublicKey = this.signing.getAdminPublicKey();
    const account = await this.rpcServer.getAccount(adminPublicKey);

    const operation = new Contract(contractId).call(method, ...args);

    const built = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    // Simulate to populate the Soroban footprint and resource fees, then sign.
    const prepared = await this.rpcServer.prepareTransaction(built);
    this.signing.signTransaction(prepared);

    const send = await this.rpcServer.sendTransaction(prepared);

    if (send.status === 'ERROR') {
      this.logger.error(`Transaction submission failed for ${method}: ${JSON.stringify(send.errorResult)}`);
      throw new InternalServerErrorException(`Failed to submit ${method} transaction`);
    }

    const result = await this.pollTransaction(send.hash);

    if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
      this.logger.error(`Transaction ${send.hash} did not succeed: ${result.status}`);
      throw new InternalServerErrorException(`Transaction ${send.hash} ${result.status}`);
    }

    return { hash: send.hash, status: result.status };
  }

  private async pollTransaction(hash: string): Promise<rpc.Api.GetTransactionResponse> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      const response = await this.rpcServer.getTransaction(hash);

      if (response.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) {
        return response;
      }

      await this.delay(POLL_INTERVAL_MS);
    }

    throw new InternalServerErrorException(`Timed out waiting for transaction ${hash}`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
