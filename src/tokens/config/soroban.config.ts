import { registerAs } from '@nestjs/config';

export const sorobanConfig = registerAs('soroban', () => ({
  network: process.env.STELLAR_NETWORK || 'testnet',
  rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
  networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  
  contracts: {
    tokenMint: process.env.SOROBAN_TOKEN_MINT_CONTRACT_ID || '', 
    tokenSale: process.env.SOROBAN_TOKEN_SALE_CONTRACT_ID || '', 
  },
  
  adminSecretKey: process.env.STELLAR_ADMIN_SECRET_KEY || '',
}));
