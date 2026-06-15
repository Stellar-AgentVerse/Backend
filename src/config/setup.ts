import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';

const DEFAULT_ALLOWED_ORIGINS = ['*'];
const DEFAULT_ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'X-Request-Id'];
const DEFAULT_EXPOSED_HEADERS = ['X-Request-Id'];

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

export function setupCompression(app: INestApplication) {
  app.use(compression({ threshold: 1024 }));
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
    allowedHeaders: DEFAULT_ALLOWED_HEADERS,
    exposedHeaders: DEFAULT_EXPOSED_HEADERS,
    maxAge: 86400,
  });
}

export function setupApp(app: INestApplication, opts?: { allowedOrigins?: string[] }) {
  app.setGlobalPrefix('api');
  setupValidation(app);
  setupCompression(app);
  setupHelmet(app);
  setupCors(app, opts?.allowedOrigins);
}
