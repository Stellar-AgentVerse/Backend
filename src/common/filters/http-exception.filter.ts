import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { STATUS_CODES } from 'http';

function normalizeMessage(responseBody: unknown, fallback: string): string | string[] {
  if (typeof responseBody === 'string') {
    return responseBody;
  }

  if (Array.isArray(responseBody)) {
    return responseBody.map((item) => String(item));
  }

  if (responseBody && typeof responseBody === 'object' && 'message' in responseBody) {
    const message = (responseBody as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.map((item) => String(item));
    }
    if (typeof message === 'string') {
      return message;
    }
  }

  return fallback;
}

function normalizeError(responseBody: unknown, fallback: string): string {
  if (responseBody && typeof responseBody === 'object' && 'error' in responseBody) {
    const error = (responseBody as { error?: unknown }).error;
    if (typeof error === 'string') {
      return error;
    }
  }

  return fallback;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const response = http.getResponse();
    const request = http.getRequest();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : 500;
    const responseBody = isHttpException ? exception.getResponse() : undefined;
    const fallbackMessage = STATUS_CODES[status] ?? 'Error';
    const message = normalizeMessage(responseBody, isHttpException ? exception.message : fallbackMessage);
    const error = normalizeError(responseBody, fallbackMessage);
    const path = request?.originalUrl ?? request?.url ?? '';
    const timestamp = new Date().toISOString();

    const body = {
      statusCode: status,
      message,
      error,
      timestamp,
      path,
    };

    if (status >= 500 && exception instanceof Error) {
      this.logger.error(`${request?.method ?? 'UNKNOWN'} ${path} -> ${status}`, exception.stack);
    } else if (status >= 500) {
      this.logger.error(`${request?.method ?? 'UNKNOWN'} ${path} -> ${status} (${error})`);
    } else {
      this.logger.warn(`${request?.method ?? 'UNKNOWN'} ${path} -> ${status}`);
    }

    response.status(status).json(body);
  }
}
