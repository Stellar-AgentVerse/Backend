import { BadRequestException } from '@nestjs/common';
import {
  OffChainExecutionPayload,
  PromptExecutionService,
} from '../src/prompt-delivery/prompt-execution.service';
import { PromptDeliveryService } from '../src/prompt-delivery/prompt-delivery.service';

describe('PromptExecutionService delivery boundary', () => {
  const verifiedEvent: OffChainExecutionPayload = {
    network: 'testnet',
    contractId: 'C123',
    transactionHash: 'hash-success-123',
    ledgerSequence: 123,
    eventIndex: 0,
    purchaseId: '7ef916ba-ee67-4f02-8c23-8d8343d5bd98',
    assetId: '7ef916ba-ee67-4f02-8c23-8d8343d5bd99',
    buyerPublicKey: 'GBSHARK',
    tenantId: 'tenant-1',
    providerName: 'openai',
    expiresAt: '2030-01-01T00:00:00.000Z',
    wrappedDek: 'wrapped-dek',
    encryptedPrompt: 'encrypted-prompt',
  };

  it('accepts only verified purchase events for asynchronous delivery', async () => {
    const delivery = {
      acceptVerifiedEvent: jest.fn().mockResolvedValue({
        canonicalId: 'canonical-id',
        state: 'AUTHORIZED',
      }),
    } as unknown as PromptDeliveryService;
    const execution = new PromptExecutionService(delivery);

    await expect(
      execution.acceptVerifiedPurchase(verifiedEvent),
    ).resolves.toEqual({
      canonicalId: 'canonical-id',
      state: 'AUTHORIZED',
    });
    expect(delivery.acceptVerifiedEvent).toHaveBeenCalledWith(verifiedEvent);
  });

  it('rejects the retired direct-execution path', async () => {
    const execution = new PromptExecutionService({} as PromptDeliveryService);

    await expect(
      execution.executeEncryptedPrompt(verifiedEvent),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
