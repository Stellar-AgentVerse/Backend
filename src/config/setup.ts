import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

const DEFAULT_ALLOWED_ORIGINS = ['*'];

export function setupValidation(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true, // Convierte tipos automáticamente
      },
    }),
  );
}

export function setupHelmet(app: INestApplication) {
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false,
    }),
  );
}

export function setupCors(app: INestApplication, allowedOrigins: string[] = DEFAULT_ALLOWED_ORIGINS) {
  const origins = allowedOrigins.length ? allowedOrigins : DEFAULT_ALLOWED_ORIGINS;
  const allowAll = origins.includes('*');

  app.enableCors({
    origin: allowAll
      ? true
      : (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin || origins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('not allowed by cors'));
        }
      },
    preflightContinue: false,
    optionsSuccessStatus: 204,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
}

export function setupApp(app: INestApplication, opts?: { allowedOrigins?: string[] }) {
  app.setGlobalPrefix('api');
  setupValidation(app);
  setupHelmet(app);
  setupCors(app, opts?.allowedOrigins);
}