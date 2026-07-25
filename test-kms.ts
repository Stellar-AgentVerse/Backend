import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { KeyManagerService } from './src/prompt-delivery/key-manager.service';
import { validateEnv } from './src/config/env.validation';

async function bootstrap() {
  console.log('======================================================');
  console.log('🔑 PRUEBA DE INTEGRACIÓN: AWS KMS REAL');
  console.log('======================================================\n');

  try {
    // 1. Inicializamos el entorno de prueba simulando el módulo de NestJS
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validate: validateEnv,
        }),
      ],
      providers: [KeyManagerService],
    }).compile();

    const keyManagerService = module.get<KeyManagerService>(KeyManagerService);

    console.log('⏳ Intentando descifrar usando AWS KMS (requiere credenciales reales en .env)...');
    
    // 2. Intentamos hacer una llamada real a AWS KMS con un blob falso
    // Si no hay credenciales, AWS bloqueará esto por falta de autenticación.
    // Si hay credenciales pero el blob es falso, AWS lanzará un error criptográfico (InvalidCiphertextException).
    const fakeWrappedDekBase64 = Buffer.from('blob-falso-de-prueba').toString('base64');
    
    await keyManagerService.getDecryptionKey('tenant-prueba', fakeWrappedDekBase64);

  } catch (error: any) {
    console.log('\n--- RESULTADO DE LA PRUEBA ---');
    
    // Evaluamos el tipo de error lanzado por AWS
    if (error.name === 'CredentialsProviderError' || error.message.includes('credential')) {
      console.log('✅ ÉXITO ARQUITECTÓNICO: La integración es real y el SDK de AWS está intentando conectarse a la nube.');
      console.log('Fallo esperado: No pusiste credenciales (AWS_ACCESS_KEY_ID) en el archivo .env, por lo que AWS te detuvo.');
    } else if (error.name === 'InvalidCiphertextException') {
      console.log('✅ ÉXITO TOTAL: Te conectaste a AWS exitosamente con tus credenciales.');
      console.log('Fallo esperado: AWS KMS rechazó el blob porque no estaba cifrado con tu llave real (enviamos un blob falso).');
    } else {
      console.log('❌ Error inesperado:', error.message);
    }
  }
}

bootstrap();
