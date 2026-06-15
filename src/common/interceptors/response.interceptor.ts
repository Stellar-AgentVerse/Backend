import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const path = getRequestPath(request);
    const requestId = getRequestId(request);

    if (path.includes('/health')) {
      return next.handle();
    }

    return next.handle().pipe(
      map((data: unknown) => ({
        data: data === undefined ? null : data,
        meta: {
          timestamp: new Date().toISOString(),
          ...(requestId ? { requestId } : {}),
        },
      })),
    );
  }
}
