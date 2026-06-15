import { INestApplication, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const SWAGGER_PATH = 'docs';
const SWAGGER_TITLE = 'AgentVerse Stellar API';
const SWAGGER_DESCRIPTION = 'OpenAPI documentation for the AgentVerse Stellar backend.';

export function shouldEnableSwagger(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' || env.SWAGGER_ENABLED === 'true';
}

export function buildSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle(SWAGGER_TITLE)
    .setDescription(SWAGGER_DESCRIPTION)
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'bearer',
    )
    .addSecurityRequirements('bearer')
    .build();
}

export function setupSwagger(app: INestApplication, options?: { env?: NodeJS.ProcessEnv }) {
  if (!shouldEnableSwagger(options?.env)) {
    return false;
  }

  try {
    const config = buildSwaggerConfig();
    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup(SWAGGER_PATH, app, document, {
      useGlobalPrefix: true,
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    return true;
  } catch (error) {
    Logger.warn(
      `Swagger bootstrap skipped: ${(error as Error).message}`,
      setupSwagger.name,
    );
    return false;
  }
}
