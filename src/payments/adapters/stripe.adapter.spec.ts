import { StripeAdapter } from './stripe.adapter';

describe('StripeAdapter', () => {
  const originalEnv = process.env.STRIPE_API_KEY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.STRIPE_API_KEY;
    } else {
      process.env.STRIPE_API_KEY = originalEnv;
    }
    jest.restoreAllMocks();
  });

  it('returns an error result when Stripe is not configured', async () => {
    delete process.env.STRIPE_API_KEY;
    const adapter = new StripeAdapter();

    await expect(
      adapter.processPayment({ amount: 10, currency: 'USD', provider: 'stripe' as never }),
    ).resolves.toEqual(
      expect.objectContaining({
        success: false,
        provider: 'stripe',
        error: 'Stripe no está configurado',
      }),
    );
  });

  it('returns a simulated success result when Stripe is configured', async () => {
    process.env.STRIPE_API_KEY = 'sk_test_123';
    jest.spyOn(Date, 'now').mockReturnValue(1704067200000);
    jest.spyOn(Math, 'random').mockReturnValue(0.123456789);
    const adapter = new StripeAdapter();

    const result = await adapter.processPayment({
      amount: 42,
      currency: 'USD',
      provider: 'stripe' as never,
      description: 'Checkout',
      customer: { email: 'alice@example.com' },
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        transactionId: 'stripe_1704067200000_4fzzzxjyl',
        amount: 42,
        currency: 'USD',
        provider: 'stripe',
        metadata: expect.objectContaining({
          description: 'Checkout',
          customer: { email: 'alice@example.com' },
          rawResponse: 'Stripe payment simulated',
        }),
      }),
    );
    expect(result.timestamp).toBeInstanceOf(Date);
  });
});
