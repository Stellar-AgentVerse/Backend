import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

const REQUEST_ID_HEADER = 'x-request-id';
const RESPONSE_HEADER = 'X-Request-Id';

export interface RequestWithRequestId extends Request {
  requestId?: string;
}

function normalizeRequestId(headerValue: unknown): string | undefined {
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim();
  }

  if (Array.isArray(headerValue) && typeof headerValue[0] === 'string' && headerValue[0].trim()) {
    return headerValue[0].trim();
  }

  return undefined;
}

export function requestIdMiddleware(req: RequestWithRequestId, res: Response, next: NextFunction) {
  const incomingRequestId = normalizeRequestId(req.headers[REQUEST_ID_HEADER]);
  const requestId = incomingRequestId ?? randomUUID();

  req.requestId = requestId;
  res.setHeader(RESPONSE_HEADER, requestId);
  next();
}
