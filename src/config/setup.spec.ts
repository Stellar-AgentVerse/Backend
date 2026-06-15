import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { setupApp, setupCompression, setupCors, setupHelmet, setupValidation } from './setup';

jest.mock('helmet', () => jest.fn(() => 'helmet-middleware'));
jest.mock('compression', () => jest.fn(() => 'compression-middleware'));

describe('setup helpers', () => {
  const createAppMock = () => ({
    setGlobalPrefix: jest.fn(),
    useGlobalPipes: jest.fn(),
    use: jest.fn(),
    enableCors: jest.fn(),
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('applies validation with the expected pipe options', () => {
    const app = createAppMock();

    setupValidation(app as never);

    expect(app.useGlobalPipes).toHaveBeenCalledTimes(1);
    const pipe = app.useGlobalPipes.mock.calls[0][0] as ValidationPipe;
    expect(pipe).toBeInstanceOf(ValidationPipe);
    expect((pipe as any).validatorOptions).toMatchObject({
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect((pipe as any).transformOptions).toEqual({ enableImplicitConversion: true });
    expect((pipe as any).isTransformEnabled).toBe(true);
  });

  it('applies helmet with CSP and embedder policies disabled', () => {
    const app = createAppMock();

    setupHelmet(app as never);

    expect(helmet).toHaveBeenCalledWith({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false,
    });
    expect(app.use).toHaveBeenCalledWith('helmet-middleware');
  });

  it('applies compression with a 1kb threshold', () => {
    const app = createAppMock();

    setupCompression(app as never);

    expect(compression).toHaveBeenCalledWith({ threshold: 1024 });
    expect(app.use).toHaveBeenCalledWith('compression-middleware');
  });

  it('enables wildcard cors origins directly', () => {
    const app = createAppMock();

    setupCors(app as never, ['*']);

    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: true,
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
        exposedHeaders: ['X-Request-Id'],
        maxAge: 86400,
      }),
    );
  });

  it('enables allowlist cors callback behavior', () => {
    const app = createAppMock();

    setupCors(app as never, ['https://allowed.example']);

    const corsOptions = app.enableCors.mock.calls[0][0];
    expect(typeof corsOptions.origin).toBe('function');

    const callback = jest.fn();
    (corsOptions.origin as (origin: string | undefined, cb: typeof callback) => void)(
      'https://allowed.example',
      callback,
    );
    expect(callback).toHaveBeenCalledWith(null, true);

    callback.mockClear();
    (corsOptions.origin as (origin: string | undefined, cb: typeof callback) => void)(
      'https://blocked.example',
      callback,
    );
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toBeInstanceOf(Error);
    expect((callback.mock.calls[0][0] as Error).message).toBe('not allowed by cors');
  });

  it('applies the application setup in order', () => {
    const app = createAppMock();

    setupApp(app as never, { allowedOrigins: ['https://allowed.example'] });

    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(app.useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(app.use).toHaveBeenCalledTimes(2);
    expect(app.enableCors).toHaveBeenCalledTimes(1);
    expect(app.use).toHaveBeenNthCalledWith(1, 'compression-middleware');
    expect(app.use).toHaveBeenNthCalledWith(2, 'helmet-middleware');
  });
});
