import { Injectable, Logger } from '@nestjs/common';

export interface IAiProviderAdapter {
  executePrompt(prompt: string): Promise<string>;
}

export class OpenAiAdapter implements IAiProviderAdapter {
  async executePrompt(prompt: string): Promise<string> {
    // Implementación usando fetch/axios
    // Opciones forzosas de privacidad: opts: { retain: false } / data_sharing: false
    // TODO: integrate exact API call
    return Promise.resolve('mock-openai-response');
  }
}

export class ClaudeAdapter implements IAiProviderAdapter {
  async executePrompt(prompt: string): Promise<string> {
    // Implementación usando SDK o HTTP
    // Opciones forzosas de privacidad.
    return Promise.resolve('mock-claude-response');
  }
}

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name);
  
  // A futuro, se rutearán a "personas"
  private providers: Record<string, IAiProviderAdapter> = {
    openai: new OpenAiAdapter(),
    claude: new ClaudeAdapter(),
  };

  /**
   * Ejecuta el prompt contra el proveedor seleccionado,
   * asegurando las banderas de no-retención.
   */
  async execute(providerName: string, prompt: string): Promise<string> {
    const adapter = this.providers[providerName];
    if (!adapter) {
      throw new Error(`Provider ${providerName} no está soportado`);
    }
    
    // Aquí NO logueamos el prompt
    this.logger.debug(`Ejecutando petición hacia proveedor ${providerName}`);
    
    const response = await adapter.executePrompt(prompt);
    
    return response;
  }
}
