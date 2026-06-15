import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  const createContext = (requestOverrides: Record<string, unknown> = {}) => {
    const request = {
      originalUrl: '/api/items',
      url: '/api/items',
      requestId: 'request-123',
      headers: {},
      ...requestOverrides,
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    };

    return { context };
  };

  it('wraps successful responses in a data/meta envelope', (done) => {
    const interceptor = new ResponseInterceptor();
    const { context } = createContext();
    const next = {
      handle: () => of({ id: 1 }),
    } as CallHandler;

    interceptor.intercept(context as ExecutionContext, next).subscribe({
      next: (value) => {
        expect(value).toEqual({
          data: { id: 1 },
          meta: {
            timestamp: expect.any(String),
            requestId: 'request-123',
          },
        });
      },
      complete: () => done(),
      error: done,
    });
  });

  it('passes health responses through unchanged', (done) => {
    const interceptor = new ResponseInterceptor();
    const { context } = createContext({ originalUrl: '/api/health', url: '/api/health' });
    const next = {
      handle: () => of({ status: 'ok' }),
    } as CallHandler;

    interceptor.intercept(context as ExecutionContext, next).subscribe({
      next: (value) => expect(value).toEqual({ status: 'ok' }),
      complete: () => done(),
      error: done,
    });
  });

  it('does not wrap errors', (done) => {
    const interceptor = new ResponseInterceptor();
    const { context } = createContext();
    const next = {
      handle: () => throwError(() => new Error('Boom')),
    } as CallHandler;

    interceptor.intercept(context as ExecutionContext, next).subscribe({
      error: (error) => {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Boom');
        done();
      },
      complete: () => done(new Error('Expected error')),
    });
  });
});
