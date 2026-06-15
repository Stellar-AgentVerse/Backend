import * as crypto from 'crypto';
import { requestIdMiddleware } from './request-id.middleware';

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(),
}));

describe('requestIdMiddleware', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reuses the incoming request id and echoes it back', () => {
    const setHeader = jest.fn();
    const next = jest.fn();
    const req = {
      headers: {
        'x-request-id': 'request-123',
      },
    } as any;
    const res = {
      setHeader,
    } as any;

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe('request-123');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'request-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('generates a request id when missing', () => {
    const setHeader = jest.fn();
    const next = jest.fn();
    (crypto.randomUUID as jest.Mock).mockReturnValue('generated-request-id');
    const req = {
      headers: {},
    } as any;
    const res = {
      setHeader,
    } as any;

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe('generated-request-id');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'generated-request-id');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
