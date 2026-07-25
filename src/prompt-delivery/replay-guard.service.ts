import { Injectable, Logger, ConflictException } from '@nestjs/common';

@Injectable()
export class ReplayGuardService {
  private readonly logger = new Logger(ReplayGuardService.name);
  
  // MOCK CACHE: En producción se debe usar Redis o DB transaction
  private executedEvents = new Set<string>();

  /**
   * Genera un identificador canónico compuesto para prevenir repetición.
   */
  generateCanonicalId(
    network: string,
    transactionHash: string,
    contractId: string,
    eventIndex: number,
    ledgerSequence?: number,
  ): string {
    return `${network}:${transactionHash}:${contractId}:${eventIndex}${ledgerSequence ? `:${ledgerSequence}` : ''}`;
  }

  /**
   * Verifica y bloquea el procesamiento del ID para evitar replay attacks.
   */
  async acquireLock(canonicalId: string): Promise<void> {
    if (this.executedEvents.has(canonicalId)) {
      this.logger.warn(`Intento de replay detectado para evento: ${canonicalId}`);
      throw new ConflictException('Este evento ya fue procesado');
    }
    
    // TODO: Adquirir lock real (Redis SET NX)
    this.executedEvents.add(canonicalId);
    this.logger.debug(`Lock adquirido para evento: ${canonicalId}`);
  }
}
