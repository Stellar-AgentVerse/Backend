import { Test, TestingModule } from '@nestjs/testing';
import { PromptDeliveryModule } from '../src/prompt-delivery/prompt-delivery.module';
import { PromptExecutionService, OffChainExecutionPayload } from '../src/prompt-delivery/prompt-execution.service';

describe('PromptDeliveryModule (e2e)', () => {
  let executionService: PromptExecutionService;
  let stdoutSpy: jest.SpyInstance;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PromptDeliveryModule],
    }).compile();

    executionService = moduleFixture.get<PromptExecutionService>(PromptExecutionService);
    // Suppress and inspect stdout
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should execute prompt delivery successfully without leaking plaintext', async () => {
    const payload: OffChainExecutionPayload = {
      network: 'testnet',
      transactionHash: 'hash-success-123',
      contractId: 'C123',
      eventIndex: 0,
      tenantId: 'tenant-1',
      wrappedDek: 'wrapped-dek',
      encryptedPrompt: 'encrypted-base64',
      providerName: 'openai'
    };

    const response = await executionService.executeEncryptedPrompt(payload);
    expect(response).toContain('[MOCK ENCRYPTED RESPONSE');

    // Comprobamos que el plaintext de la respuesta o del prompt no haya escapado a process.stdout (logs)
    const allStdout = stdoutSpy.mock.calls.map(call => call[0]).join('');
    expect(allStdout).not.toContain('mock-openai-response');
    // En logs (si existieran, aunque aquí usamos Logger de nest que va a stdout)
  });

  it('should prevent replay attacks end-to-end', async () => {
    const payload: OffChainExecutionPayload = {
      network: 'testnet',
      transactionHash: 'hash-replay-456',
      contractId: 'C456',
      eventIndex: 1,
      tenantId: 'tenant-1',
      wrappedDek: 'wrapped-dek',
      encryptedPrompt: 'encrypted-base64',
      providerName: 'claude'
    };

    // Primera vez exitoso
    await expect(executionService.executeEncryptedPrompt(payload)).resolves.toBeDefined();

    // Segunda vez falla por replay guard
    await expect(executionService.executeEncryptedPrompt(payload)).rejects.toThrow('Este evento ya fue procesado');
  });
});
