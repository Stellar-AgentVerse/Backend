import { randomBytes } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { EnvelopeCryptoService } from './envelope-crypto.service';
import { createDeliveryCommand } from './delivery-command';

describe('EnvelopeCryptoService', () => {
  const service = new EnvelopeCryptoService();
  const command = createDeliveryCommand({
    network: 'testnet',
    contractId: 'contract',
    transactionHash: 'tx',
    ledgerSequence: 10,
    eventIndex: 0,
    purchaseId: 'purchase',
    assetId: 'asset',
    buyerPublicKey: 'buyer',
    tenantId: 'tenant',
    providerName: 'test',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    wrappedDek: 'wrapped',
    encryptedPrompt: 'encrypted',
  });

  it('round-trips with fresh nonces and command-bound AAD', () => {
    const key = randomBytes(32);
    const first = service.encrypt(Buffer.from('secret'), key, command);
    const second = service.encrypt(Buffer.from('secret'), key, command);
    expect(first.nonce).not.toBe(second.nonce);
    expect(service.decrypt(first, key, command).toString()).toBe('secret');
  });

  it('fails closed when command metadata or tag is changed', () => {
    const key = randomBytes(32);
    const envelope = service.encrypt(Buffer.from('secret'), key, command);
    const other = createDeliveryCommand({
      ...command,
      tenantId: 'other-tenant',
    });
    expect(() => service.decrypt(envelope, key, other)).toThrow(
      BadRequestException,
    );
    expect(() =>
      service.decrypt(
        { ...envelope, tag: randomBytes(16).toString('base64url') },
        key,
        command,
      ),
    ).toThrow(BadRequestException);
  });
});
