import { ConfigService } from '@nestjs/config';
import { MockPaymentAdapter } from './mock-payment.adapter';
import { SIMULATED_ID_PREFIX } from './base-payment.adapter';

const configWithSimulation = (enabled: boolean) =>
  ({
    get: jest.fn((key: string) =>
      key === 'payments.simulationEnabled' ? enabled : undefined,
    ),
  }) as unknown as ConfigService;

describe('MockPaymentAdapter', () => {
  const originalFail = process.env.MOCK_PAYMENT_FAIL;

  afterEach(() => {
    if (originalFail === undefined) delete process.env.MOCK_PAYMENT_FAIL;
    else process.env.MOCK_PAYMENT_FAIL = originalFail;

    jest.restoreAllMocks();
  });

  it('is not configured when simulation is disabled', () => {
    expect(
      new MockPaymentAdapter(configWithSimulation(false)).isConfigured(),
    ).toBe(false);
  });

  it('refuses to fabricate anything when simulation is disabled', async () => {
    const adapter = new MockPaymentAdapter(configWithSimulation(false));

    const payment = await adapter.processPayment({
      amount: 25,
      currency: 'USD',
      provider: 'mock',
    } as never);

    expect(payment.success).toBe(false);
    expect(payment.transactionId).toBe('N/A');
    expect(payment.error).toContain('Payment simulation is disabled');

    await expect(
      adapter.processRefund({ transactionId: 'tx-1' } as never),
    ).resolves.toMatchObject({ success: false });
    await expect(adapter.verifyTransaction('tx-1')).resolves.toMatchObject({
      success: false,
    });
  });

  it('returns a clearly simulated payment when simulation is enabled', async () => {
    delete process.env.MOCK_PAYMENT_FAIL;
    const adapter = new MockPaymentAdapter(configWithSimulation(true));

    const result = await adapter.processPayment({
      amount: 25,
      currency: 'USD',
      provider: 'mock',
      description: 'Test order',
    } as never);

    expect(result.success).toBe(true);
    expect(result.transactionId.startsWith(SIMULATED_ID_PREFIX)).toBe(true);
    expect(result.metadata).toMatchObject({
      simulated: true,
      mockNote: 'This is a simulated payment for testing purposes',
    });
  });

  it('returns a simulated error when configured to fail', async () => {
    process.env.MOCK_PAYMENT_FAIL = 'true';
    const adapter = new MockPaymentAdapter(configWithSimulation(true));

    await expect(
      adapter.processPayment({
        amount: 25,
        currency: 'USD',
        provider: 'mock',
      } as never),
    ).resolves.toMatchObject({
      success: false,
      error: 'Mock payment configured to fail',
    });
  });
});
