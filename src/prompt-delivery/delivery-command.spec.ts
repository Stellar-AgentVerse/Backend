import { createDeliveryCommand } from './delivery-command';

const event = {
  network: 'testnet',
  contractId: 'contract',
  transactionHash: 'tx',
  ledgerSequence: 1,
  eventIndex: 0,
  purchaseId: 'purchase',
  assetId: 'asset',
  buyerPublicKey: 'buyer',
  tenantId: 'tenant',
  providerName: 'provider',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  wrappedDek: 'wrapped',
  encryptedPrompt: 'ciphertext',
};

describe('delivery command canonicalization', () => {
  it('is deterministic and binds chain/event/tenant metadata', () => {
    const first = createDeliveryCommand(event);
    const second = createDeliveryCommand({ ...event });
    expect(first.canonicalId).toBe(second.canonicalId);
    expect(
      createDeliveryCommand({ ...event, eventIndex: 1 }).canonicalId,
    ).not.toBe(first.canonicalId);
    expect(
      createDeliveryCommand({ ...event, tenantId: 'other' }).canonicalId,
    ).not.toBe(first.canonicalId);
  });

  it('rejects malformed and expired commands before persistence', () => {
    expect(() => createDeliveryCommand({ ...event, eventIndex: -1 })).toThrow();
    expect(() =>
      createDeliveryCommand({ ...event, expiresAt: 'not-a-date' }),
    ).toThrow();
  });
});
