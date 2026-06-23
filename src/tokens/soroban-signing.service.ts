import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Keypair, Transaction } from '@stellar/stellar-sdk';
import { sorobanConfig } from './config/soroban.config';

/**
 * Holds the admin keypair derived from STELLAR_ADMIN_SECRET_KEY and signs
 * Soroban transactions on its behalf. This is the only place a secret key is
 * turned into a usable keypair; all token operations are admin-signed.
 */
@Injectable()
export class SorobanSigningService implements OnModuleInit {
  private readonly logger = new Logger(SorobanSigningService.name);
  private adminKeypair: Keypair | null = null;

  constructor(
    @Inject(sorobanConfig.KEY)
    private readonly config: { adminSecretKey: string },
  ) {}

  onModuleInit() {
    const secret = this.config.adminSecretKey?.trim();

    if (!secret) {
      this.logger.warn(
        'STELLAR_ADMIN_SECRET_KEY is not configured. Token operations that require signing will be rejected.',
      );
      return;
    }

    // The seed format was already validated at env-validation time.
    this.adminKeypair = Keypair.fromSecret(secret);
    this.logger.log(`Admin signer configured: ${this.adminKeypair.publicKey()}`);
  }

  isAdminConfigured(): boolean {
    return this.adminKeypair !== null;
  }

  getAdminPublicKey(): string {
    return this.requireAdminKeypair().publicKey();
  }

  signTransaction(transaction: Transaction): void {
    transaction.sign(this.requireAdminKeypair());
  }

  private requireAdminKeypair(): Keypair {
    if (!this.adminKeypair) {
      throw new ServiceUnavailableException('Admin signer is not configured');
    }

    return this.adminKeypair;
  }
}
