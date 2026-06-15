import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Logger,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

function getRequestPath(request: { originalUrl?: string; url?: string }) {
  return request.originalUrl ?? request.url ?? '';
}

function getRequestId(request: { requestId?: string; headers?: Record<string, unknown> }) {
  const headerValue = request.headers?.['x-request-id'];
  if (typeof request.requestId === 'string' && request.requestId) {
    return request.requestId;
  }

  if (typeof headerValue === 'string' && headerValue) {
    return headerValue;
  }

  return undefined;
}

function getStatusCode(error: unknown) {
  if (error instanceof HttpException) {
    return error.getStatus();
  }

  return 500;
}

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const path = getRequestPath(request);

    if (path.includes('/health')) {
      return next.handle();
    }

    const requestId = getRequestId(request);
    const startedAt = Date.now();

    const log = (statusCode: number, error?: unknown) => {
      const duration = Date.now() - startedAt;
      const parts = [`${request.method} ${path}`, `${statusCode}`, `${duration}ms`];

      if (requestId) {
        parts.push(`requestId=${requestId}`);
      }

      if (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        parts.push(message);
      }

      this.logger.log(parts.join(' '));
    };

    return next.handle().pipe(
      tap(() => {
        log(response.statusCode ?? 200);
      }),
      catchError((error: unknown) => {
        log(getStatusCode(error), error);
        return throwError(() => error);
      }),
    );
  }
}
