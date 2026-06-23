import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Keypair } from '@stellar/stellar-sdk';
import { sorobanConfig } from './config/soroban.config';
import { SorobanSigningService } from './soroban-signing.service';

async function buildService(adminSecretKey: string) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      SorobanSigningService,
      {
        provide: sorobanConfig.KEY,
        useValue: { adminSecretKey },
      },
    ],
  }).compile();

  return module.get(SorobanSigningService);
}

describe('SorobanSigningService', () => {
  it('derives the admin keypair from a configured secret', async () => {
    const keypair = Keypair.random();
    const service = await buildService(keypair.secret());

    service.onModuleInit();

    expect(service.isAdminConfigured()).toBe(true);
    expect(service.getAdminPublicKey()).toBe(keypair.publicKey());
  });

  it('signs a transaction with the admin keypair', async () => {
    const keypair = Keypair.random();
    const service = await buildService(keypair.secret());
    service.onModuleInit();

    const tx = { sign: jest.fn() } as any;
    service.signTransaction(tx);

    expect(tx.sign).toHaveBeenCalledTimes(1);
  });

  it('reports unconfigured and throws when the secret is missing', async () => {
    const service = await buildService('');

    service.onModuleInit();

    expect(service.isAdminConfigured()).toBe(false);
    expect(() => service.getAdminPublicKey()).toThrow(ServiceUnavailableException);
  });
});
