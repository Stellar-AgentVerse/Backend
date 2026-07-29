import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KMSClient, DecryptCommand, EncryptCommand } from '@aws-sdk/client-kms';
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
  async getDecryptionKey(
    tenantId: string,
    wrappedDek: string,
    context: Record<string, string> = {},
  ): Promise<Buffer> {
    try {
      const command = new DecryptCommand({
        CiphertextBlob: Buffer.from(wrappedDek, 'base64'),
        KeyId: this.configService.get('aws.keyId', { infer: true }),
        EncryptionContext: { tenantId, ...context },
      });
      const response = await this.kmsClient.send(command);

      if (!response.Plaintext) {
        throw new Error('KMS Decrypt response missing Plaintext');
      }

      // Convert Uint8Array to Node.js Buffer
      return Buffer.from(response.Plaintext);
    } catch (error: any) {
      this.logger.error('KMS decrypt failed', error?.stack);
      if (error?.message === 'KMS Decrypt response missing Plaintext')
        throw error;
      throw new Error('KMS decrypt failed');
    }
  }

  async wrapKey(
    key: Buffer,
    tenantId: string,
    context: Record<string, string> = {},
  ): Promise<Buffer> {
    try {
      const response = await this.kmsClient.send(
        new EncryptCommand({
          KeyId: this.configService.get('aws.keyId', { infer: true }),
          Plaintext: key,
          EncryptionContext: { tenantId, ...context },
        }),
      );
      if (!response.CiphertextBlob) throw new Error('missing ciphertext');
      return Buffer.from(response.CiphertextBlob);
    } catch (error: any) {
      this.logger.error('KMS encrypt failed', error?.stack);
      throw new Error('KMS encrypt failed');
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
