import { PayPalAdapter } from './paypal.adapter';

describe('PayPalAdapter', () => {
  const originalClientId = process.env.PAYPAL_CLIENT_ID;
  const originalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const originalEnv = process.env.PAYPAL_ENV;

  afterEach(() => {
    if (originalClientId === undefined) delete process.env.PAYPAL_CLIENT_ID;
    else process.env.PAYPAL_CLIENT_ID = originalClientId;

    if (originalClientSecret === undefined) delete process.env.PAYPAL_CLIENT_SECRET;
    else process.env.PAYPAL_CLIENT_SECRET = originalClientSecret;

    if (originalEnv === undefined) delete process.env.PAYPAL_ENV;
    else process.env.PAYPAL_ENV = originalEnv;

    jest.restoreAllMocks();
  });

  it('returns an error result when PayPal is not configured', async () => {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    const adapter = new PayPalAdapter();

    await expect(
      adapter.processRefund({ transactionId: 'tx-1', reason: 'duplicate' }),
    ).resolves.toEqual(
      expect.objectContaining({
        success: false,
        provider: 'paypal',
        error: 'PayPal no está configurado',
      }),
    );
  });

  it('returns a simulated success result when PayPal is configured', async () => {
    process.env.PAYPAL_CLIENT_ID = 'client-id';
    process.env.PAYPAL_CLIENT_SECRET = 'client-secret';
    process.env.PAYPAL_ENV = 'production';
    jest.spyOn(Date, 'now').mockReturnValue(1704067200000);
    jest.spyOn(Math, 'random').mockReturnValue(0.987654321);
    const adapter = new PayPalAdapter();

    const result = await adapter.processPayment({
      amount: 18,
      currency: 'USD',
      provider: 'paypal' as never,
      description: 'Checkout',
      customer: { name: 'Alice' },
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        transactionId: expect.stringMatching(/^paypal_1704067200000_/),
        amount: 18,
        currency: 'USD',
        provider: 'paypal',
        metadata: expect.objectContaining({
          description: 'Checkout',
          customer: { name: 'Alice' },
          environment: 'production',
          rawResponse: 'PayPal payment simulated',
        }),
      }),
    );
    expect(result.timestamp).toBeInstanceOf(Date);
  });
});
