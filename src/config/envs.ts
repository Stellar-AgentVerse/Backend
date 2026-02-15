const parseAllowedOrigins = (raw: string | undefined): string[] => {
  if (!raw || raw.trim() === '*') {
    return ['*'];
  }

  return raw
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
};

const getEnv = (key: string, fallback?: string, options?: { requiredInProd?: boolean }): string | undefined => {
  const val = process.env[key] ?? fallback;
  if (options?.requiredInProd && process.env.NODE_ENV === 'production' && (val === undefined || val === '')) {
    throw new Error(`${key} is required in production`);
  }
  return val;
};

export default () => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  const portRaw = getEnv('PORT', '3000', { requiredInProd: true })!;
  const dbPortRaw = getEnv('DB_PORT', '5432', { requiredInProd: true })!;
  const dbHost = getEnv('DB_HOST', 'localhost', { requiredInProd: true })!;

  // Validate numeric envs
  const port = Number(portRaw);
  const dbPort = Number(dbPortRaw);
  if (Number.isNaN(port)) {
    throw new Error('PORT must be a valid number');
  }

  if (Number.isNaN(dbPort)) {
    throw new Error('DB_PORT must be a valid number');
  }

  // Encryption configuration
  const encryptionKey = getEnv('ENCRYPTION_KEY', undefined, { requiredInProd: true });
  const encryptionIv = getEnv('ENCRYPTION_IV', undefined, { requiredInProd: true });

  return {
    app: {
      port,
      allowedOrigins: parseAllowedOrigins(process.env.ALLOWED_ORIGINS),
      nodeEnv,
    },
    database: {
      host: dbHost,
      port: dbPort,
    },
    ENCRYPTION_KEY: encryptionKey,
    ENCRYPTION_IV: encryptionIv,
  } as const;
};