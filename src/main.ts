import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './config';
import { setupSwagger } from './config/swagger';
import { getValidatedEnv } from './config/env.validation';
import { DataSource } from 'typeorm';
import { seedDatabase } from './database/seed';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app, { allowedOrigins: getValidatedEnv().corsOrigins });
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  setupSwagger(app);

  // Seed database on first run
  try {
    const dataSource = app.get(DataSource);
    await seedDatabase(dataSource);
  } catch (err) {
    console.warn('Seed skipped (DB may not be ready):', (err as Error).message);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
