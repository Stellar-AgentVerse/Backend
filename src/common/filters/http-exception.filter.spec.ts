import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const createHost = (requestOverrides: Record<string, unknown> = {}) => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const request = {
      method: 'GET',
      originalUrl: '/api/test',
      url: '/api/test',
      ...requestOverrides,
    };

    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    };

    return { host, response };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps HttpException to the standard body shape', () => {
    const filter = new HttpExceptionFilter();
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { host, response } = createHost();

    filter.catch(new NotFoundException('Resource missing'), host as never);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Resource missing',
        error: 'Not Found',
        path: '/api/test',
      }),
    );
    expect(warnSpy).toHaveBeenCalled();
  });

  it('maps unknown errors to 500 with a safe response', () => {
    const filter = new HttpExceptionFilter();
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { host, response } = createHost();

    filter.catch(new Error('Boom'), host as never);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal Server Error',
        error: 'Internal Server Error',
        path: '/api/test',
      }),
    );
    expect(errorSpy).toHaveBeenCalled();
  });

  it('keeps validation messages intact when provided as arrays', () => {
    const filter = new HttpExceptionFilter();
    const { host, response } = createHost();

    filter.catch(
      new BadRequestException({
        statusCode: 400,
        message: ['name must be a string'],
        error: 'Bad Request',
      }),
      host as never,
    );

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: ['name must be a string'],
        error: 'Bad Request',
      }),
    );
  });
});
