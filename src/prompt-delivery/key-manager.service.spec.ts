import { Test, TestingModule } from '@nestjs/testing';
import { KeyManagerService } from './key-manager.service';

describe('KeyManagerService', () => {
  let service: KeyManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KeyManagerService],
    }).compile();

    service = module.get<KeyManagerService>(KeyManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should retrieve a mock decryption key', async () => {
    const key = await service.getDecryptionKey('tenant-1', 'wrapped-dek-123');
    expect(key).toBeInstanceOf(Buffer);
    expect(key.toString('utf8')).toContain('mock-decrypted-key');
  });

  it('should explicitly zero out the key buffer in memory', () => {
    const key = Buffer.from('my-super-secret-key-that-must-not-leak');
    service.zeroKey(key);
    
    // El buffer debe mantener su longitud pero estar lleno de ceros
    expect(key.length).toBe(38);
    for (let i = 0; i < key.length; i++) {
      expect(key[i]).toBe(0);
    }
  });
});
