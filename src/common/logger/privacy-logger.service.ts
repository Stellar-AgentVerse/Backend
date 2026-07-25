import { ConsoleLogger, Injectable } from '@nestjs/common';

@Injectable()
export class PrivacyLogger extends ConsoleLogger {
  
  private redact(message: any): string {
    if (typeof message !== 'string') {
      try {
        message = JSON.stringify(message);
      } catch {
        return '[UNSERIALIZABLE]';
      }
    }

    // Filtros de redacción (Regex o lógica)
    // Ejemplo: Ocultar llaves base64 o patrones de prompts
    let redacted = message;
    
    // Regla 1: Ocultar cualquier texto marcado con tags de prompt
    redacted = redacted.replace(/\[MOCK DECRYPTED PROMPT.*?\]/g, '[REDACTED PROMPT]');
    
    // Regla 2: Ocultar cualquier key
    redacted = redacted.replace(/(key=)[a-zA-Z0-9+\/]+={0,2}/g, '$1[REDACTED]');

    return redacted;
  }

  log(message: any, context?: string) {
    super.log(this.redact(message), context);
  }

  error(message: any, stack?: string, context?: string) {
    super.error(this.redact(message), stack, context);
  }

  warn(message: any, context?: string) {
    super.warn(this.redact(message), context);
  }

  debug(message: any, context?: string) {
    super.debug(this.redact(message), context);
  }

  verbose(message: any, context?: string) {
    super.verbose(this.redact(message), context);
  }
}
