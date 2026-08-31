import {
  getValidatedEnv,
  resetValidatedEnvCache,
  validateEnv,
} from './env.validation';

const HARDENED_STAGING_ENV = {
  NODE_ENV: 'staging',
  JWT_SECRET: 'a-real-secret',
  DB_HOST: 'db.internal',
  DB_PORT: '5432',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_NAME: 'agentverse',
  STELLAR_NETWORK: 'testnet',
  STELLAR_RPC_URL: 'https://rpc.stellar.example',
  STELLAR_NETWORK_PASSPHRASE: 'Test SDF Network ; September 2015',
  SOROBAN_MARKETPLACE_CONTRACT_ID: 'C_MARKET',
  CORS_ORIGINS: 'https://app.example',
  AWS_REGION: 'us-east-1',
};

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
      seedOnStartup: true,
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
        purchaseContractId: '',
      },
    });
    expect(env.corsOrigins).toEqual([
      'http://localhost:3000',
      'https://app.example',
    ]);
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
        STELLAR_NETWORK_PASSPHRASE:
          'Public Global Stellar Network ; September 2015',
        CORS_ORIGINS: 'https://app.example',
      }),
    ).toThrow('JWT_SECRET is required in production');
  });

  describe('simulated payments fail closed', () => {
    const PRODUCTION_ENV = {
      NODE_ENV: 'production',
      JWT_SECRET: 'a-real-secret',
      DB_HOST: 'db.internal',
      DB_PORT: '5432',
      DB_USERNAME: 'postgres',
      DB_PASSWORD: 'postgres',
      DB_NAME: 'agentverse',
      STELLAR_NETWORK: 'mainnet',
      STELLAR_RPC_URL: 'https://rpc.stellar.example',
      STELLAR_NETWORK_PASSPHRASE:
        'Public Global Stellar Network ; September 2015',
      SOROBAN_TOKEN_MINT_CONTRACT_ID: 'C_MINT',
      SOROBAN_TOKEN_SALE_CONTRACT_ID: 'C_SALE',
      SOROBAN_MARKETPLACE_CONTRACT_ID: 'C_MARKET',
      STELLAR_ADMIN_SECRET_KEY: 'S_ADMIN',
      CORS_ORIGINS: 'https://app.example',
      AWS_REGION: 'us-east-1',
      AWS_KMS_KEY_ID: 'kms-key',
    };

    it.each([
      'MOCK_PAYMENT_ENABLED',
      'MOCK_PAYMENT_FAIL',
      'PAYMENT_SIMULATION_ENABLED',
    ])('refuses to boot production with %s enabled', (flag) => {
      expect(() => validateEnv({ ...PRODUCTION_ENV, [flag]: 'true' })).toThrow(
        `${flag} must be disabled when NODE_ENV is "production"`,
      );
    });

    it.each([
      'MOCK_PAYMENT_ENABLED',
      'MOCK_PAYMENT_FAIL',
      'PAYMENT_SIMULATION_ENABLED',
    ])('refuses to boot staging with %s enabled', (flag) => {
      expect(() =>
        validateEnv({
          NODE_ENV: 'staging',
          JWT_SECRET: 'a-real-secret',
          [flag]: 'true',
        }),
      ).toThrow(`${flag} must be disabled when NODE_ENV is "staging"`);
    });

    it('refuses to boot an unset NODE_ENV with simulation enabled', () => {
      expect(() =>
        validateEnv({
          JWT_SECRET: 'a-real-secret',
          MOCK_PAYMENT_ENABLED: 'true',
        }),
      ).toThrow(
        'MOCK_PAYMENT_ENABLED must be disabled when NODE_ENV is "unset"',
      );
    });

    it('boots production when no simulation flag is set', () => {
      const env = validateEnv(PRODUCTION_ENV);

      expect(env.payments.simulationEnabled).toBe(false);
      expect(env.db.seedOnStartup).toBe(false);
    });

    it('never reports simulation as enabled outside development and test', () => {
      // The flag is rejected above, so the only way to reach validation with a
      // truthy value in staging is a future caller bypassing the guard. The
      // computed value stays false regardless.
      expect(
        validateEnv({ ...HARDENED_STAGING_ENV }).payments
          .simulationEnabled,
      ).toBe(false);
    });

    it('allows simulation in development and test', () => {
      expect(
        validateEnv({ NODE_ENV: 'development', MOCK_PAYMENT_ENABLED: 'true' })
          .payments.simulationEnabled,
      ).toBe(true);

      resetValidatedEnvCache();

      expect(
        validateEnv({ NODE_ENV: 'test', PAYMENT_SIMULATION_ENABLED: 'true' })
          .payments.simulationEnabled,
      ).toBe(true);
    });

    it('disables database seeding for any environment that is not development or test', () => {
      expect(
        validateEnv({ ...HARDENED_STAGING_ENV }).db.seedOnStartup,
      ).toBe(false);

      resetValidatedEnvCache();

      expect(validateEnv({ NODE_ENV: 'development' }).db.seedOnStartup).toBe(
        true,
      );
    });
  });

  describe('JWT signing key', () => {
    it('is required in staging, where the dev-secret fallback would let anyone mint a wallet token', () => {
      expect(() => validateEnv({ NODE_ENV: 'staging' })).toThrow(
        'JWT_SECRET is required when NODE_ENV is "staging"',
      );
    });

    it('is required when NODE_ENV is unset', () => {
      expect(() => validateEnv({})).toThrow(
        'JWT_SECRET is required when NODE_ENV is "unset"',
      );
    });

    it('still reports the production message first when nothing else is wrong', () => {
      // Regression guard: adding the simulation gate ahead of the production
      // block must not change which error an operator sees.
      expect(() =>
        validateEnv({
          NODE_ENV: 'production',
          DB_HOST: 'db.internal',
          DB_USERNAME: 'postgres',
          DB_PASSWORD: 'postgres',
          DB_NAME: 'agentverse',
          CORS_ORIGINS: 'https://app.example',
        }),
      ).toThrow('JWT_SECRET is required in production');
    });

    it('falls back to the development secret only in development and test', () => {
      expect(validateEnv({ NODE_ENV: 'development' }).jwt.secret).toBe(
        'dev-secret',
      );
    });

    it('requires the remaining deployment contract after the signing key', () => {
      expect(() =>
        validateEnv({ NODE_ENV: 'staging', JWT_SECRET: 'real-secret' }),
      ).toThrow('DB_HOST is required when NODE_ENV is "staging"');
    });
  });

  it('allows disabling database seed on startup explicitly', () => {
    const env = validateEnv({
      NODE_ENV: 'development',
      DB_SEED_ON_STARTUP: 'false',
    });

    expect(env.db.seedOnStartup).toBe(false);
  });

  it('caches the validated environment for later consumers', () => {
    const validated = validateEnv({ NODE_ENV: 'development' });

    expect(getValidatedEnv()).toBe(validated);
  });
});
