import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { HealthReport, HealthService } from './health.service';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Readiness. Returns 503 when a required dependency is down so that rollout
   * gates and load balancers stop sending traffic to a deployment that cannot
   * serve it. Responses are not wrapped by ResponseInterceptor (it bypasses any
   * path containing `/health`).
   */
  @Get()
  async check(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthReport> {
    const report = await this.health.check();

    res.status(
      report.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return report;
  }

  /**
   * Liveness. Answers "is this process running", nothing more. Restart probes
   * use this so a transient dependency outage does not cycle containers.
   */
  @Get('live')
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
