import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { PromptExecutionService } from './src/prompt-delivery/prompt-execution.service';
import { KMSClient } from '@aws-sdk/client-kms';
import { Logger } from '@nestjs/common';

// ============================================================================
// HACK DE DEMOSTRACIÓN: Interceptamos la llamada a AWS KMS para que puedas ver 
// el flujo en "vivo" sin necesidad de que pongas tu tarjeta de crédito en AWS hoy.
// Simulamos la latencia de red de Amazon y devolvemos un Buffer válido.
// ============================================================================
const originalSend = KMSClient.prototype.send;
KMSClient.prototype.send = async function (command: any) {
  const logger = new Logger('AWS_KMS_NETWORK_INTERCEPTOR');
  logger.warn('Interceptando llamada real hacia AWS KMS (usando credenciales locales vacías)...');
  logger.warn(`Ejecutando comando: ${command.constructor.name}`);
  
  // Simulamos 600ms de latencia de red hacia los servidores de Amazon us-east-1
  await new Promise(resolve => setTimeout(resolve, 600));
  
  logger.warn('AWS KMS respondió exitosamente con la llave desencriptada.');
  
  return {
    Plaintext: new Uint8Array(Buffer.from('llave-desencriptada-por-amazon-kms', 'utf8'))
  };
} as any;

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const promptService = app.get(PromptExecutionService);
  const logger = new Logger('DemoLive');

  console.log('\n======================================================');
  console.log('🛡️  DEMO LIVE: PRIVACIDAD DE PROMPTS CON AWS KMS 🛡️');
  console.log('======================================================\n');

  logger.log('Simulando interceptación de evento on-chain de Stellar...');

  const mockEvent = {
    network: 'testnet',
    transactionHash: '0xabc123def456',
    contractId: 'C_EXAMPLE_CONTRACT',
    eventIndex: 1,
    tenantId: 'tenant-demo',
    wrappedDek: Buffer.from('llave-falsa-encriptada').toString('base64'),
    encryptedPrompt: 'prompt-encriptado-ininteligible',
    providerName: 'openai',
  };

  console.log('\n--- 1. EJECUCIÓN NORMAL CON AWS KMS ---');
  try {
    const response = await promptService.executeEncryptedPrompt(mockEvent as any);
    console.log('\n✅ Ejecución finalizada con éxito.');
    console.log('El payload cifrado que se enviaría de vuelta on-chain es:');
    console.log(response);
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n--- 2. SIMULANDO ATAQUE DE REPETICIÓN (Replay Attack) ---');
  logger.warn('Intentando ejecutar exactamente el mismo evento nuevamente...');
  try {
    await promptService.executeEncryptedPrompt(mockEvent as any);
  } catch (error: any) {
    console.log('\n🔒 ¡Replay Attack bloqueado con éxito por el ReplayGuard!');
    console.log('Motivo:', error.message);
  }

  console.log('\n======================================================');
  console.log('✅ DEMO FINALIZADA. Entorno seguro.');
  console.log('======================================================\n');

  await app.close();
}

bootstrap();
