import { getValidatedEnv, resetValidatedEnvCache, validateEnv } from './env.validation';

describe('validateEnv', () => {
  afterEach(() => {
    resetValidatedEnvCache();
  });

  it('applies safe development defaults and parses CSV cors origins', () => {
    const env = validateEnv({
      NODE_ENV: 'development',
      CORS_ORIGINS: 'http://localhost:3000, https://app.example',
    });

    expect(env.db).toEqual({
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'agentverse',
      synchronize: true,
      logging: false,
    });
    expect(env.jwt).toEqual({
      secret: 'dev-secret',
      expiresIn: '24h',
    });
    expect(env.stellar).toEqual({
      network: 'testnet',
      rpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015',
      adminSecretKey: '',
      contracts: {
        tokenMint: '',
        tokenSale: '',
      },
    });
    expect(env.corsOrigins).toEqual(['http://localhost:3000', 'https://app.example']);
  });

  it('rejects invalid cors origins and database ports', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        DB_PORT: '70000',
      }),
    ).toThrow('DB_PORT must be an integer between 1 and 65535');

    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        CORS_ORIGINS: 'https://good.example,not-a-url',
      }),
    ).toThrow('CORS_ORIGINS must contain valid origins or *');
  });

  it('requires critical production secrets and endpoints', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DB_HOST: 'db.internal',
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'postgres',
        DB_NAME: 'agentverse',
        STELLAR_NETWORK: 'mainnet',
        STELLAR_RPC_URL: 'https://rpc.stellar.example',
        STELLAR_NETWORK_PASSPHRASE: 'Public Global Stellar Network ; September 2015',
        CORS_ORIGINS: 'https://app.example',
      }),
    ).toThrow('JWT_SECRET is required in production');
  });

  it('caches the validated environment for later consumers', () => {
    const validated = validateEnv({ NODE_ENV: 'development' });

    expect(getValidatedEnv()).toBe(validated);
  });
});
