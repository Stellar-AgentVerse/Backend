import { registerAs } from '@nestjs/config';

export const sorobanConfig = registerAs('soroban', () => ({
  network: process.env.STELLAR_NETWORK || 'testnet',
  rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
  networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  
  // Aquí debes colocar los IDs de tus contratos una vez desplegados
  contracts: {
    tokenMint: process.env.SOROBAN_TOKEN_MINT_CONTRACT_ID || 'CONTRACT_ID_PLACEHOLDER_FOR_MINTING',
    tokenSale: process.env.SOROBAN_TOKEN_SALE_CONTRACT_ID || 'CONTRACT_ID_PLACEHOLDER_FOR_SELLING',
  },
  
  // Clave secreta del admin/operador que firmará las transacciones (si aplica)
  adminSecretKey: process.env.STELLAR_ADMIN_SECRET_KEY || '',
}));
