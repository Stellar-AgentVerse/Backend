import { AppEnv, DEV_DEFAULTS } from './env.schema';

let validatedEnvCache: AppEnv | null = null;

const REQUIRED_IN_PRODUCTION = {
  db: ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_NAME'] as const,
  jwt: ['JWT_SECRET'] as const,
  stellar: ['STELLAR_NETWORK', 'STELLAR_RPC_URL', 'STELLAR_NETWORK_PASSPHRASE'] as const,
  cors: ['CORS_ORIGINS'] as const,
};

function parseBoolean(value: string | undefined, fallback: boolean, key: string): boolean {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (['true', '1', 'yes'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no'].includes(normalized)) {
    return false;
  }

  throw new Error(`${key} must be a boolean`);
}

function parsePort(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const port = Number.parseInt(value, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('DB_PORT must be an integer between 1 and 65535');
  }

  return port;
}

function parseCorsOrigins(value: string | undefined, allowWildcard: boolean): string[] {
  if (value === undefined || value.trim() === '') {
    return allowWildcard ? [...DEV_DEFAULTS.corsOrigins] : [];
  }

  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!origins.length) {
    return allowWildcard ? [...DEV_DEFAULTS.corsOrigins] : [];
  }

  if (!allowWildcard && origins.includes('*')) {
    throw new Error('CORS_ORIGINS must list explicit origins in production');
  }

  for (const origin of origins) {
    if (origin === '*') {
      continue;
    }

    try {
      new URL(origin);
    } catch {
      throw new Error('CORS_ORIGINS must contain valid origins or *');
    }
  }

  return [...new Set(origins)];
}

function ensureProductionRequirement(env: NodeJS.ProcessEnv, key: string) {
  if (env[key] === undefined || env[key]?.trim() === '') {
    throw new Error(`${key} is required in production`);
  }
}

export function validateEnv(env: NodeJS.ProcessEnv): AppEnv {
  const isProduction = env.NODE_ENV === 'production';

  if (isProduction) {
    ensureProductionRequirement(env, REQUIRED_IN_PRODUCTION.jwt[0]);

    for (const key of REQUIRED_IN_PRODUCTION.db) {
      ensureProductionRequirement(env, key);
    }

    for (const key of REQUIRED_IN_PRODUCTION.stellar) {
      ensureProductionRequirement(env, key);
    }

    ensureProductionRequirement(env, REQUIRED_IN_PRODUCTION.cors[0]);
  }

  const validated: AppEnv = {
    db: {
      host: env.DB_HOST ?? DEV_DEFAULTS.db.host,
      port: parsePort(env.DB_PORT, DEV_DEFAULTS.db.port),
      username: env.DB_USERNAME ?? DEV_DEFAULTS.db.username,
      password: env.DB_PASSWORD ?? DEV_DEFAULTS.db.password,
      database: env.DB_NAME ?? DEV_DEFAULTS.db.database,
      synchronize: parseBoolean(env.DB_SYNCHRONIZE, isProduction ? false : DEV_DEFAULTS.db.synchronize, 'DB_SYNCHRONIZE'),
      logging: parseBoolean(env.DB_LOGGING, DEV_DEFAULTS.db.logging, 'DB_LOGGING'),
    },
    jwt: {
      secret: env.JWT_SECRET ?? DEV_DEFAULTS.jwt.secret,
      expiresIn: env.JWT_EXPIRES_IN ?? DEV_DEFAULTS.jwt.expiresIn,
    },
    stellar: {
      network: env.STELLAR_NETWORK ?? DEV_DEFAULTS.stellar.network,
      rpcUrl: env.STELLAR_RPC_URL ?? DEV_DEFAULTS.stellar.rpcUrl,
      networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE ?? DEV_DEFAULTS.stellar.networkPassphrase,
      contracts: {
        tokenMint: env.SOROBAN_TOKEN_MINT_CONTRACT_ID ?? DEV_DEFAULTS.stellar.contracts.tokenMint,
        tokenSale: env.SOROBAN_TOKEN_SALE_CONTRACT_ID ?? DEV_DEFAULTS.stellar.contracts.tokenSale,
      },
      adminSecretKey: env.STELLAR_ADMIN_SECRET_KEY ?? DEV_DEFAULTS.stellar.adminSecretKey,
    },
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS, !isProduction),
  };

  validatedEnvCache = validated;
  return validated;
}

export function getValidatedEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  if (validatedEnvCache) {
    return validatedEnvCache;
  }

  return validateEnv(env);
}

export function resetValidatedEnvCache() {
  validatedEnvCache = null;
}
