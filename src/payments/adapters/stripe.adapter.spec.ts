import { ConfigService } from '@nestjs/config';
import { StripeAdapter } from './stripe.adapter';
import { SIMULATED_ID_PREFIX } from './base-payment.adapter';

const configWithSimulation = (enabled: boolean) =>
  ({
    get: jest.fn((key: string) =>
      key === 'payments.simulationEnabled' ? enabled : undefined,
    ),
  }) as unknown as ConfigService;

describe('StripeAdapter', () => {
  const originalApiKey = process.env.STRIPE_API_KEY;

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.STRIPE_API_KEY;
    else process.env.STRIPE_API_KEY = originalApiKey;
    jest.restoreAllMocks();
  });

  it('is not configured when no API key is present', () => {
    delete process.env.STRIPE_API_KEY;

    expect(new StripeAdapter(configWithSimulation(true)).isConfigured()).toBe(
      false,
    );
  });

  describe('when payment simulation is disabled', () => {
    beforeEach(() => {
      process.env.STRIPE_API_KEY = 'sk_live_looks_completely_real';
    });

    it('is not configured even with a credential present', () => {
      // The bug this closes: a non-empty STRIPE_API_KEY used to be the only
      // condition required to start fabricating successful payments.
      expect(
        new StripeAdapter(configWithSimulation(false)).isConfigured(),
      ).toBe(false);
    });

    it('refuses payment without inventing a transaction id', async () => {
      const adapter = new StripeAdapter(configWithSimulation(false));

      const result = await adapter.processPayment({
        amount: 42,
        currency: 'USD',
        provider: 'stripe',
      } as never);

      expect(result.success).toBe(false);
      expect(result.transactionId).toBe('N/A');
      expect(result.error).toContain('Payment simulation is disabled');
    });

    it('refuses refunds and verification too', async () => {
      const adapter = new StripeAdapter(configWithSimulation(false));

      await expect(
        adapter.processRefund({ transactionId: 'tx-1' } as never),
      ).resolves.toMatchObject({ success: false });
      await expect(adapter.verifyTransaction('tx-1')).resolves.toMatchObject({
        success: false,
      });
    });
  });

  describe('when payment simulation is enabled', () => {
    beforeEach(() => {
      process.env.STRIPE_API_KEY = 'sk_test_key';
    });

    it('marks the fabricated result as simulated', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1704067200000);
      jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

      const adapter = new StripeAdapter(configWithSimulation(true));
      const result = await adapter.processPayment({
        amount: 42,
        currency: 'USD',
        provider: 'stripe',
        description: 'Checkout',
      } as never);

      expect(result.success).toBe(true);
      expect(result.transactionId.startsWith(SIMULATED_ID_PREFIX)).toBe(true);
      expect(result.metadata).toMatchObject({ simulated: true });
    });
  });
});
