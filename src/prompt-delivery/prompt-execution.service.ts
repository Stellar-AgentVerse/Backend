import { Injectable, Logger } from '@nestjs/common';
import { KeyManagerService } from './key-manager.service';
import { AiProviderService } from './ai-provider.service';
import { ReplayGuardService } from './replay-guard.service';

export interface OffChainExecutionPayload {
  network: string;
  transactionHash: string;
  contractId: string;
  eventIndex: number;
  ledgerSequence?: number;
  tenantId: string;
  wrappedDek: string;
  encryptedPrompt: string; // Base64 o Hex
  providerName: string;
}

@Injectable()
export class PromptExecutionService {
  private readonly logger = new Logger(PromptExecutionService.name);

  constructor(
    private readonly keyManager: KeyManagerService,
    private readonly aiProvider: AiProviderService,
    private readonly replayGuard: ReplayGuardService,
  ) {}

  /**
   * Ejecuta el flujo completo de prompt off-chain manteniendo las garantías de privacidad:
   * 1. Verifica Replay Attack.
   * 2. Desencripta (obteniendo DEK de KMS temporalmente).
   * 3. Ejecuta contra proveedor de IA (sin retención).
   * 4. Encripta la respuesta (simulado).
   * 5. Limpia la DEK de memoria.
   */
  async executeEncryptedPrompt(payload: OffChainExecutionPayload): Promise<string> {
    const canonicalId = this.replayGuard.generateCanonicalId(
      payload.network,
      payload.transactionHash,
      payload.contractId,
      payload.eventIndex,
      payload.ledgerSequence,
    );

    // 1. Replay Guard
    await this.replayGuard.acquireLock(canonicalId);
    this.logger.debug(`Iniciando ejecución de prompt para evento: ${canonicalId}`);

    let dekBuffer: Buffer | null = null;
    let plaintextPrompt = '';
    let plaintextResponse = '';

    try {
      // 2. Desencriptar (KMS + Envelope Encryption)
      dekBuffer = await this.keyManager.getDecryptionKey(payload.tenantId, payload.wrappedDek);
      
      // Decrypt logic here (mocked)
      // crypto.createDecipheriv(...)
      plaintextPrompt = `[MOCK DECRYPTED PROMPT from ${payload.encryptedPrompt}]`;

      // 3. Ejecutar proveedor de IA
      plaintextResponse = await this.aiProvider.execute(payload.providerName, plaintextPrompt);

      // 4. Re-encriptar la respuesta para devolverla al entorno on-chain
      // const encryptedResponse = crypto.createCipheriv(...)
      const encryptedResponse = `[MOCK ENCRYPTED RESPONSE for ${plaintextResponse}]`;
      
      this.logger.log(`Ejecución de prompt exitosa para evento: ${canonicalId}`);
      return encryptedResponse;

    } catch (error) {
      this.logger.error(`Error ejecutando prompt para evento ${canonicalId}`, error.stack);
      throw error;
    } finally {
      // 5. Destrucción explícita de datos sensibles en memoria
      if (dekBuffer) {
        this.keyManager.zeroKey(dekBuffer);
      }
      // Aseguramos de que el Garbage Collector libere el string, o lo sobreescribimos.
      plaintextPrompt = '';
      plaintextResponse = '';
    }
  }
}
