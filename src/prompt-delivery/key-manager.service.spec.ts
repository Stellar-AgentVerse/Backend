import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KeyManagerService } from './key-manager.service';
import { KMSClient, DecryptCommand } from '@aws-sdk/client-kms';

jest.mock('@aws-sdk/client-kms');

describe('KeyManagerService', () => {
  let service: KeyManagerService;
  let kmsClientMock: any;

  beforeEach(async () => {
    (KMSClient as jest.Mock).mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeyManagerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('us-east-1'),
          },
        },
      ],
    }).compile();

    service = module.get<KeyManagerService>(KeyManagerService);
    kmsClientMock = (KMSClient as jest.Mock).mock.instances[0];
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should retrieve a decryption key via AWS KMS', async () => {
    const mockPlaintext = Buffer.from('mock-decrypted-key-from-aws', 'utf8');
    kmsClientMock.send = jest.fn().mockResolvedValue({
      Plaintext: mockPlaintext,
    });

    const key = await service.getDecryptionKey('tenant-1', 'wrapped-dek-123');
    
    expect(kmsClientMock.send).toHaveBeenCalled();
    const commandArg = (kmsClientMock.send as jest.Mock).mock.calls[0][0];
    expect(commandArg).toBeInstanceOf(DecryptCommand);
    
    expect(key).toBeInstanceOf(Buffer);
    expect(key.toString('utf8')).toBe('mock-decrypted-key-from-aws');
  });

  it('should throw error if KMS Decrypt response missing Plaintext', async () => {
    kmsClientMock.send = jest.fn().mockResolvedValue({});

    await expect(service.getDecryptionKey('tenant-1', 'wrapped-dek-123')).rejects.toThrow(
      'KMS Decrypt response missing Plaintext',
    );
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
