import { ConfigService } from '@nestjs/config';
import { PayPalAdapter } from './paypal.adapter';
import { SIMULATED_ID_PREFIX } from './base-payment.adapter';

const configWithSimulation = (enabled: boolean) =>
  ({
    get: jest.fn((key: string) =>
      key === 'payments.simulationEnabled' ? enabled : undefined,
    ),
  }) as unknown as ConfigService;

describe('PayPalAdapter', () => {
  const originalClientId = process.env.PAYPAL_CLIENT_ID;
  const originalSecret = process.env.PAYPAL_CLIENT_SECRET;

  afterEach(() => {
    if (originalClientId === undefined) delete process.env.PAYPAL_CLIENT_ID;
    else process.env.PAYPAL_CLIENT_ID = originalClientId;

    if (originalSecret === undefined) delete process.env.PAYPAL_CLIENT_SECRET;
    else process.env.PAYPAL_CLIENT_SECRET = originalSecret;

    jest.restoreAllMocks();
  });

  it('is not configured without credentials', () => {
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;

    expect(new PayPalAdapter(configWithSimulation(true)).isConfigured()).toBe(
      false,
    );
  });

  describe('when payment simulation is disabled', () => {
    beforeEach(() => {
      process.env.PAYPAL_CLIENT_ID = 'live-client-id';
      process.env.PAYPAL_CLIENT_SECRET = 'live-client-secret';
    });

    it('is not configured even with credentials present', () => {
      expect(
        new PayPalAdapter(configWithSimulation(false)).isConfigured(),
      ).toBe(false);
    });

    it('refuses payment without inventing a transaction id', async () => {
      const adapter = new PayPalAdapter(configWithSimulation(false));

      const result = await adapter.processPayment({
        amount: 15,
        currency: 'USD',
        provider: 'paypal',
      } as never);

      expect(result.success).toBe(false);
      expect(result.transactionId).toBe('N/A');
      expect(result.error).toContain('Payment simulation is disabled');
    });

    it('refuses refunds and verification too', async () => {
      const adapter = new PayPalAdapter(configWithSimulation(false));

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
      process.env.PAYPAL_CLIENT_ID = 'test-client-id';
      process.env.PAYPAL_CLIENT_SECRET = 'test-client-secret';
    });

    it('marks the fabricated result as simulated', async () => {
      const adapter = new PayPalAdapter(configWithSimulation(true));

      const result = await adapter.processPayment({
        amount: 15,
        currency: 'USD',
        provider: 'paypal',
        description: 'Checkout',
      } as never);

      expect(result.success).toBe(true);
      expect(result.transactionId.startsWith(SIMULATED_ID_PREFIX)).toBe(true);
      expect(result.metadata).toMatchObject({ simulated: true });
    });
  });
});
