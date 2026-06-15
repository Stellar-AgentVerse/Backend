import { Logger, INestApplication } from '@nestjs/common';

type SignalName = 'SIGINT' | 'SIGTERM';

export function registerGracefulShutdown(app: INestApplication, processLike: Pick<NodeJS.Process, 'once'> = process) {
  const logger = new Logger('GracefulShutdown');

  const shutdown = async (signal: SignalName) => {
    logger.log(`${signal} received, closing application`);

    try {
      await app.close();
      logger.log('Application closed successfully');
    } catch (error) {
      logger.error(`Application shutdown failed: ${(error as Error).message}`);
    }
  };

  processLike.once('SIGTERM', () => {
    return shutdown('SIGTERM');
  });

  processLike.once('SIGINT', () => {
    return shutdown('SIGINT');
  });
}
