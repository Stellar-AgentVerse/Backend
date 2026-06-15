import { Logger } from '@nestjs/common';
import { registerGracefulShutdown } from './graceful-shutdown';

describe('registerGracefulShutdown', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers SIGTERM and SIGINT handlers', () => {
    const app = {
      close: jest.fn().mockResolvedValue(undefined),
    } as any;
    const once = jest.fn();

    registerGracefulShutdown(app, { once } as never);

    expect(once).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(once).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });

  it('closes the application when a signal is received', async () => {
    const app = {
      close: jest.fn().mockResolvedValue(undefined),
    } as any;
    const once = jest.fn();
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    registerGracefulShutdown(app, { once } as never);

    const sigtermHandler = once.mock.calls.find(([signal]) => signal === 'SIGTERM')?.[1];
    await sigtermHandler();

    expect(app.close).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('SIGTERM received, closing application');
    expect(logSpy).toHaveBeenCalledWith('Application closed successfully');
  });
});
