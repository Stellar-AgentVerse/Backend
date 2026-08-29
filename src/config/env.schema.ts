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
  purchaseContractId: string;
}

export interface StellarEnv {
  network: string;
  rpcUrl: string;
  networkPassphrase: string;
  contracts: StellarContractsEnv;
  adminSecretKey: string;
}

export interface AwsEnv {
  region: string;
  keyId?: string;
}

export interface PaymentsEnv {
  /**
   * Whether the Stripe/PayPal/mock adapters may fabricate a successful
   * payment result. Only ever true in development and test; `validateEnv`
   * refuses to boot a real deployment with it enabled.
   */
  simulationEnabled: boolean;
}

export interface AppEnv {
  db: DatabaseEnv;
  jwt: JwtEnv;
  stellar: StellarEnv;
  corsOrigins: string[];
  aws: AwsEnv;
  payments: PaymentsEnv;
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
    contracts: {
      tokenMint: '',
      tokenSale: '',
      purchaseContractId: '',
    },
    adminSecretKey: '',
  },
  corsOrigins: ['*'],
  aws: {
    region: 'us-east-1',
  },
  payments: {
    simulationEnabled: false,
  },
} as const;
