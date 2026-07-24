import { PrivacyLogger } from './privacy-logger.service';

describe('PrivacyLogger', () => {
  let logger: PrivacyLogger;
  let stdoutSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new PrivacyLogger('TestContext');
    // Mock the stdout write to prevent actual printing during tests and allow assertion
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should redact [MOCK DECRYPTED PROMPT...]', () => {
    logger.log('Executing prompt [MOCK DECRYPTED PROMPT from encrypted-data]');
    
    // Extraemos lo que el logger realmente imprimió
    const output = stdoutSpy.mock.calls[0][0] as string;
    expect(output).toContain('[REDACTED PROMPT]');
    expect(output).not.toContain('[MOCK DECRYPTED PROMPT');
    expect(output).not.toContain('encrypted-data');
  });

  it('should redact sensitive keys passed in strings', () => {
    logger.debug('Connecting to provider with key=sk-12345ABCDE==');
    
    const output = stdoutSpy.mock.calls[0][0] as string;
    expect(output).toContain('key=[REDACTED]');
    expect(output).not.toContain('sk-12345ABCDE');
  });

  it('should safely serialize and redact objects', () => {
    const sensitivePayload = {
      message: 'Processing request',
      key: 'key=secret123',
    };
    
    logger.log(sensitivePayload);
    const output = stdoutSpy.mock.calls[0][0] as string;
    
    expect(output).toContain('key=[REDACTED]');
    expect(output).not.toContain('secret123');
  });
});
