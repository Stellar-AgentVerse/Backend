import { MockPaymentAdapter } from './mock-payment.adapter';

describe('MockPaymentAdapter', () => {
  const originalEnabled = process.env.MOCK_PAYMENT_ENABLED;
  const originalFail = process.env.MOCK_PAYMENT_FAIL;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    if (originalEnabled === undefined) delete process.env.MOCK_PAYMENT_ENABLED;
    else process.env.MOCK_PAYMENT_ENABLED = originalEnabled;

    if (originalFail === undefined) delete process.env.MOCK_PAYMENT_FAIL;
    else process.env.MOCK_PAYMENT_FAIL = originalFail;

    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns a simulated payment after the configured delay', async () => {
    process.env.MOCK_PAYMENT_ENABLED = 'true';
    delete process.env.MOCK_PAYMENT_FAIL;
    const adapter = new MockPaymentAdapter();

    const promise = adapter.processPayment({
      amount: 12,
      currency: 'USD',
      provider: 'mock' as never,
      description: 'Sandbox purchase',
      customer: { email: 'demo@example.com' },
    });

    await jest.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toEqual(
      expect.objectContaining({
        success: true,
        transactionId: expect.stringMatching(/^mock_1704067200500_/),
        amount: 12,
        currency: 'USD',
        provider: 'mock',
        metadata: expect.objectContaining({
          description: 'Sandbox purchase',
          customer: { email: 'demo@example.com' },
          mockNote: 'This is a simulated payment for testing purposes',
        }),
      }),
    );
  });

  it('returns a simulated error when configured to fail', async () => {
    process.env.MOCK_PAYMENT_ENABLED = 'true';
    process.env.MOCK_PAYMENT_FAIL = 'true';
    const adapter = new MockPaymentAdapter();

    const promise = adapter.processRefund({
      transactionId: 'tx-1',
      amount: 3,
      reason: 'duplicate',
    });

    await jest.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toEqual(
      expect.objectContaining({
        success: false,
        provider: 'mock',
        error: 'Mock refund configured to fail',
        transactionId: 'tx-1',
      }),
    );
  });
});
