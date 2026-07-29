import { Module } from '@nestjs/common';
import { KeyManagerService } from './key-manager.service';
import { AiProviderService } from './ai-provider.service';
import { PromptExecutionService } from './prompt-execution.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DeliveryCommandEntity,
  DeliveryResultEntity,
  DeliveryOutboxEntity,
  Purchase,
} from '../database/entities';
import { EnvelopeCryptoService } from './envelope-crypto.service';
import { PromptDeliveryService } from './prompt-delivery.service';
import { PromptDeliveryWorker } from './prompt-delivery.worker';
import { PromptDeliveryController } from './prompt-delivery.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeliveryCommandEntity,
      DeliveryResultEntity,
      DeliveryOutboxEntity,
      Purchase,
    ]),
  ],
  controllers: [PromptDeliveryController],
  providers: [
    KeyManagerService,
    AiProviderService,
    PromptExecutionService,
    EnvelopeCryptoService,
    PromptDeliveryService,
    PromptDeliveryWorker,
  ],
  exports: [
    PromptExecutionService,
    PromptDeliveryService,
    PromptDeliveryWorker,
    AiProviderService,
  ],
})
export class PromptDeliveryModule {}
