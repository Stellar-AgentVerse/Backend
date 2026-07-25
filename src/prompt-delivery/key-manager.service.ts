import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';
import { AppEnv } from '../config/env.schema';

@Injectable()
export class KeyManagerService {
  private readonly logger = new Logger(KeyManagerService.name);
  private readonly kmsClient: KMSClient;

  constructor(private readonly configService: ConfigService<AppEnv>) {
    // ConfigService infer read from env.validation.ts
    const region = this.configService.get('aws.region', { infer: true });
    this.kmsClient = new KMSClient({ region: region || 'us-east-1' });
  }

  /**
   * Retrieves a Data Encryption Key (DEK) via KMS using Workload Identity.
   * Uses Envelope Encryption: DEK is unwrapped using a KMS-managed KEK.
   * The key is only held in memory temporarily.
   */
  async getDecryptionKey(tenantId: string, wrappedDek: string): Promise<Buffer> {
    this.logger.debug(`Soliciting decryption key for tenant ${tenantId} via AWS KMS`);
    try {
      const command = new DecryptCommand({
        CiphertextBlob: Buffer.from(wrappedDek, 'base64'),
      });
      const response = await this.kmsClient.send(command);
      
      if (!response.Plaintext) {
        throw new Error('KMS Decrypt response missing Plaintext');
      }

      // Convert Uint8Array to Node.js Buffer
      return Buffer.from(response.Plaintext);
    } catch (error: any) {
      this.logger.error(`Failed to decrypt DEK for tenant ${tenantId}`, error.stack);
      throw error;
    }
  }

  /**
   * Explicitly zeros out a Buffer in memory to prevent key leakage
   * in core dumps or memory inspection.
   */
  zeroKey(keyBuffer: Buffer): void {
    if (keyBuffer && Buffer.isBuffer(keyBuffer)) {
      keyBuffer.fill(0);
    }
  }
}
