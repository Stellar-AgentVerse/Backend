export interface DatabaseEnv {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
  logging: boolean;
  seedOnStartup: boolean;
}

export interface JwtEnv {
  secret: string;
  expiresIn: string;
}

export interface StellarContractsEnv {
  tokenMint: string;
  tokenSale: string;
}

export interface StellarEnv {
  network: string;
  rpcUrl: string;
  networkPassphrase: string;
  contracts: StellarContractsEnv;
  adminSecretKey: string;
}

export interface AppEnv {
  db: DatabaseEnv;
  jwt: JwtEnv;
  stellar: StellarEnv;
  corsOrigins: string[];
}

export const DEV_DEFAULTS = {
  db: {
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
    database: 'agentverse',
    synchronize: true,
    logging: false,
    seedOnStartup: true,
  },
  jwt: {
    secret: 'dev-secret',
    expiresIn: '24h',
  },
  stellar: {
    network: 'testnet',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015',
    // Soroban contract ids must be valid C... addresses; required in production.
    contracts: {
      tokenMint: '',
      tokenSale: '',
    },
    // Admin secret must be a valid S... seed; used to sign all token operations. Required in production.
    adminSecretKey: '',
  },
  corsOrigins: ['*'],
} as const;
