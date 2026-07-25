import { Module } from '@nestjs/common';
import { KeyManagerService } from './key-manager.service';
import { AiProviderService } from './ai-provider.service';
import { PromptExecutionService } from './prompt-execution.service';
import { ReplayGuardService } from './replay-guard.service';

@Module({
  providers: [
    KeyManagerService,
    AiProviderService,
    PromptExecutionService,
    ReplayGuardService,
  ],
  exports: [PromptExecutionService],
})
export class PromptDeliveryModule {}
