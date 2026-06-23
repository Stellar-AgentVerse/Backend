import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { getValidatedEnv, resetValidatedEnvCache, validateEnv } from './env.validation';

const VALID_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 1));
const VALID_ADMIN_SECRET = Keypair.random().secret();

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

  it('parses and validates well-formed Soroban contract ids and admin secret', () => {
    const env = validateEnv({
      NODE_ENV: 'development',
      SOROBAN_TOKEN_MINT_CONTRACT_ID: VALID_CONTRACT_ID,
      SOROBAN_TOKEN_SALE_CONTRACT_ID: VALID_CONTRACT_ID,
      STELLAR_ADMIN_SECRET_KEY: VALID_ADMIN_SECRET,
    });

    expect(env.stellar.contracts).toEqual({
      tokenMint: VALID_CONTRACT_ID,
      tokenSale: VALID_CONTRACT_ID,
    });
    expect(env.stellar.adminSecretKey).toBe(VALID_ADMIN_SECRET);
  });

  it('rejects malformed Soroban contract ids', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        SOROBAN_TOKEN_MINT_CONTRACT_ID: 'not-a-contract',
      }),
    ).toThrow('SOROBAN_TOKEN_MINT_CONTRACT_ID must be a valid Soroban contract id (C...)');
  });

  it('rejects malformed admin secret keys', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        STELLAR_ADMIN_SECRET_KEY: 'not-a-secret',
      }),
    ).toThrow('STELLAR_ADMIN_SECRET_KEY must be a valid Stellar secret seed (S...)');
  });

  it('requires Soroban contract ids and admin secret in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        JWT_SECRET: 'super-secret',
        DB_HOST: 'db.internal',
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'postgres',
        DB_NAME: 'agentverse',
        STELLAR_NETWORK: 'mainnet',
        STELLAR_RPC_URL: 'https://rpc.stellar.example',
        STELLAR_NETWORK_PASSPHRASE: 'Public Global Stellar Network ; September 2015',
        SOROBAN_TOKEN_MINT_CONTRACT_ID: VALID_CONTRACT_ID,
        SOROBAN_TOKEN_SALE_CONTRACT_ID: VALID_CONTRACT_ID,
        CORS_ORIGINS: 'https://app.example',
      }),
    ).toThrow('STELLAR_ADMIN_SECRET_KEY is required in production');
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
