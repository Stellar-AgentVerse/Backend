import { CallHandler, ExecutionContext, Logger, NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

describe('RequestLoggingInterceptor', () => {
  const createContext = (requestOverrides: Record<string, unknown> = {}, responseOverrides: Record<string, unknown> = {}) => {
    const request = {
      method: 'GET',
      originalUrl: '/api/items',
      url: '/api/items',
      requestId: 'request-123',
      headers: {},
      ...requestOverrides,
    };

    const response = {
      statusCode: 200,
      ...responseOverrides,
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };

    return { context, request, response };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs status, duration, and request id for successful requests', (done) => {
    const interceptor = new RequestLoggingInterceptor();
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1000).mockReturnValueOnce(1125);
    const { context, response } = createContext({}, { statusCode: 201 });
    const next = {
      handle: () => of('ok'),
    } as CallHandler;

    interceptor.intercept(context as ExecutionContext, next).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledWith('GET /api/items 201 125ms requestId=request-123');
        expect(response.statusCode).toBe(201);
        done();
      },
      error: done,
    });
  });

  it('skips health requests', () => {
    const interceptor = new RequestLoggingInterceptor();
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const { context } = createContext({ originalUrl: '/api/health', url: '/api/health' });
    const next = {
      handle: () => of('ok'),
    } as CallHandler;

    interceptor.intercept(context as ExecutionContext, next).subscribe();

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('logs error responses with the failure status', (done) => {
    const interceptor = new RequestLoggingInterceptor();
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(2000).mockReturnValueOnce(2080);
    const { context } = createContext();
    const next = {
      handle: () => throwError(() => new NotFoundException('Missing')),
    } as CallHandler;

    interceptor.intercept(context as ExecutionContext, next).subscribe({
      error: (error) => {
        expect(error).toBeInstanceOf(NotFoundException);
        expect(logSpy).toHaveBeenCalledWith('GET /api/items 404 80ms requestId=request-123 Missing');
        done();
      },
      complete: () => done(new Error('Expected error')),
    });
  });
});
