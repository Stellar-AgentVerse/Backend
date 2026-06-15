import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './config';
import { DataSource } from 'typeorm';
import { seedDatabase } from './database/seed';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  setupApp(app);

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
