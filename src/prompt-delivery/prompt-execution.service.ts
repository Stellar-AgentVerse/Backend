import { BadRequestException, Injectable } from '@nestjs/common';
import { PromptDeliveryService } from './prompt-delivery.service';
import { VerifiedPurchaseEvent } from './delivery-command';

export type OffChainExecutionPayload = VerifiedPurchaseEvent;

/** Compatibility facade. Execution is now asynchronous and can only start from a verified purchase event. */
@Injectable()
export class PromptExecutionService {
  constructor(private readonly delivery: PromptDeliveryService) {}

  async acceptVerifiedPurchase(event: VerifiedPurchaseEvent) {
    return this.delivery.acceptVerifiedEvent(event);
  }

  async executeEncryptedPrompt(
    _payload: OffChainExecutionPayload,
  ): Promise<never> {
    throw new BadRequestException(
      'Direct prompt execution is disabled; submit a verified purchase event',
    );
  }
}
