import { BadRequestException, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { deliveryAad, DeliveryCommand } from './delivery-command';

const VERSION = 1;
const ALGORITHM = 'aes-256-gcm';
const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;
const MAX_PLAINTEXT = 1024 * 1024;

export interface EncryptedEnvelope {
  version: number;
  algorithm: typeof ALGORITHM;
  nonce: string;
  ciphertext: string;
  tag: string;
}

@Injectable()
export class EnvelopeCryptoService {
  encrypt(
    plaintext: Buffer,
    key: Buffer,
    command: DeliveryCommand,
    result = false,
  ): EncryptedEnvelope {
    this.validateKey(key);
    if (plaintext.length > MAX_PLAINTEXT)
      throw new BadRequestException('Encrypted payload is too large');
    const nonce = randomBytes(NONCE_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, nonce);
    cipher.setAAD(deliveryAad(command, result));
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    return {
      version: VERSION,
      algorithm: ALGORITHM,
      nonce: nonce.toString('base64url'),
      ciphertext: ciphertext.toString('base64url'),
      tag: cipher.getAuthTag().toString('base64url'),
    };
  }

  decrypt(
    envelope: EncryptedEnvelope,
    key: Buffer,
    command: DeliveryCommand,
    result = false,
  ): Buffer {
    this.validateKey(key);
    if (envelope?.version !== VERSION || envelope.algorithm !== ALGORITHM)
      throw new BadRequestException('Unsupported encrypted envelope');
    try {
      const nonce = Buffer.from(envelope.nonce, 'base64url');
      const ciphertext = Buffer.from(envelope.ciphertext, 'base64url');
      const tag = Buffer.from(envelope.tag, 'base64url');
      if (
        nonce.length !== NONCE_LENGTH ||
        tag.length !== TAG_LENGTH ||
        ciphertext.length > MAX_PLAINTEXT
      )
        throw new Error('invalid envelope size');
      const decipher = createDecipheriv(ALGORITHM, key, nonce);
      decipher.setAAD(deliveryAad(command, result));
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);
      if (plaintext.length > MAX_PLAINTEXT)
        throw new Error('payload too large');
      return plaintext;
    } catch {
      throw new BadRequestException('Encrypted payload authentication failed');
    }
  }

  private validateKey(key: Buffer): void {
    if (!Buffer.isBuffer(key) || key.length !== 32)
      throw new BadRequestException('Invalid encryption key');
  }
}
