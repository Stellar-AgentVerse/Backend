import { SwaggerModule } from '@nestjs/swagger';
import { buildSwaggerConfig, setupSwagger, shouldEnableSwagger } from './swagger';

jest.mock('@nestjs/swagger', () => {
  const actual = jest.requireActual('@nestjs/swagger');

  return {
    ...actual,
    SwaggerModule: {
      createDocument: jest.fn(),
      setup: jest.fn(),
    },
  };
});

describe('swagger bootstrap helpers', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('builds an OpenAPI config with bearer auth enabled', () => {
    const config = buildSwaggerConfig();

    expect(config).toMatchObject({
      components: {
        securitySchemes: {
          bearer: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearer: [] }],
    });
  });

  it('enables swagger in development and hides it in production by default', () => {
    expect(shouldEnableSwagger({ NODE_ENV: 'development' })).toBe(true);
    expect(shouldEnableSwagger({ NODE_ENV: 'production' })).toBe(false);
    expect(shouldEnableSwagger({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' })).toBe(true);
  });

  it('mounts docs under the global prefix and keeps startup fail-soft', () => {
    const app = {} as never;
    const createDocument = SwaggerModule.createDocument as jest.Mock;
    const setup = SwaggerModule.setup as jest.Mock;
    createDocument.mockReturnValue({ openapi: '3.0.0' });

    const result = setupSwagger(app, { env: { NODE_ENV: 'development' } });

    expect(result).toBe(true);
    expect(createDocument).toHaveBeenCalledWith(app, expect.any(Object));
    expect(setup).toHaveBeenCalledWith(
      'docs',
      app,
      expect.objectContaining({ openapi: '3.0.0' }),
      expect.objectContaining({ useGlobalPrefix: true }),
    );
  });

  it('skips swagger in production when the flag is disabled', () => {
    const app = {} as never;
    const createDocument = SwaggerModule.createDocument as jest.Mock;
    const setup = SwaggerModule.setup as jest.Mock;

    const result = setupSwagger(app, { env: { NODE_ENV: 'production' } });

    expect(result).toBe(false);
    expect(createDocument).not.toHaveBeenCalled();
    expect(setup).not.toHaveBeenCalled();
  });

  it('returns false when swagger setup throws', () => {
    const app = {} as never;
    const createDocument = SwaggerModule.createDocument as jest.Mock;
    createDocument.mockImplementation(() => {
      throw new Error('boom');
    });

    const result = setupSwagger(app, { env: { NODE_ENV: 'development' } });

    expect(result).toBe(false);
  });
});
