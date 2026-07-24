import { Test, TestingModule } from '@nestjs/testing';
import { ReplayGuardService } from './replay-guard.service';
import { ConflictException } from '@nestjs/common';

describe('ReplayGuardService', () => {
  let service: ReplayGuardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReplayGuardService],
    }).compile();

    service = module.get<ReplayGuardService>(ReplayGuardService);
  });

  it('should generate canonical ID properly', () => {
    const id1 = service.generateCanonicalId('testnet', 'hash123', 'C123', 0);
    expect(id1).toBe('testnet:hash123:C123:0');

    const id2 = service.generateCanonicalId('testnet', 'hash123', 'C123', 0, 100);
    expect(id2).toBe('testnet:hash123:C123:0:100');
  });

  it('should acquire lock successfully for a new event', async () => {
    const id = 'testnet:hash123:C123:0';
    await expect(service.acquireLock(id)).resolves.not.toThrow();
  });

  it('should throw ConflictException on replay attempt', async () => {
    const id = 'testnet:hash456:C456:1';
    await service.acquireLock(id); // primer intento exitoso
    
    // segundo intento con el mismo ID debe fallar
    await expect(service.acquireLock(id)).rejects.toThrow(ConflictException);
    await expect(service.acquireLock(id)).rejects.toThrow('Este evento ya fue procesado');
  });
});
