import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private dataSource: DataSource) {}

  @Get()
  async check() {
    let dbStatus = 'connected';
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      dbStatus = 'error';
    }
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      db: dbStatus,
    };
  }
}
