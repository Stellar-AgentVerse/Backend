import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { StripeAdapter } from './adapters/stripe.adapter';
import { PayPalAdapter } from './adapters/paypal.adapter';
import { PaymentProvider } from './common/interfaces/payment-request.interface';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let stripeAdapter: jest.Mocked<StripeAdapter>;
  let paypalAdapter: jest.Mocked<PayPalAdapter>;

  beforeEach(async () => {
    const stripeAdapterMock = {
      processPayment: jest.fn(),
      processRefund: jest.fn(),
      verifyTransaction: jest.fn(),
      isConfigured: jest.fn(),
      getProviderName: jest.fn(),
    } as unknown as jest.Mocked<StripeAdapter>;

    const paypalAdapterMock = {
      processPayment: jest.fn(),
      processRefund: jest.fn(),
      verifyTransaction: jest.fn(),
      isConfigured: jest.fn(),
      getProviderName: jest.fn(),
    } as unknown as jest.Mocked<PayPalAdapter>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: StripeAdapter, useValue: stripeAdapterMock },
        { provide: PayPalAdapter, useValue: paypalAdapterMock },
      ],
    }).compile();

    service = module.get(PaymentsService);
    stripeAdapter = module.get(StripeAdapter) as jest.Mocked<StripeAdapter>;
    paypalAdapter = module.get(PayPalAdapter) as jest.Mocked<PayPalAdapter>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('routes payment creation to the selected provider adapter', async () => {
    const dto = {
      amount: 25,
      currency: 'USD',
      provider: PaymentProvider.STRIPE,
      description: 'Order',
      customer: { email: 'a@example.com' },
      metadata: { orderId: '1' },
    };
    const result = { success: true, transactionId: 'stripe_1' };
    stripeAdapter.processPayment.mockResolvedValue(result as never);

    await expect(service.processPayment(dto as never)).resolves.toEqual(result);
    expect(stripeAdapter.processPayment).toHaveBeenCalledWith({
      amount: 25,
      currency: 'USD',
      provider: PaymentProvider.STRIPE,
      description: 'Order',
      customer: { email: 'a@example.com' },
      metadata: { orderId: '1' },
    });
    expect(paypalAdapter.processPayment).not.toHaveBeenCalled();
  });

  it('throws when payment provider is missing', async () => {
    await expect(
      service.processPayment({ amount: 10, currency: 'USD' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when payment provider is unsupported', async () => {
    await expect(
      service.processPayment({ amount: 10, currency: 'USD', provider: 'square' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('routes refunds to the selected provider adapter', async () => {
    const dto = {
      transactionId: 'tx-1',
      amount: 5,
      reason: 'duplicate',
      provider: PaymentProvider.PAYPAL,
    };
    const result = { success: true, transactionId: 'paypal_refund_1' };
    paypalAdapter.processRefund.mockResolvedValue(result as never);

    await expect(service.processRefund(dto as never)).resolves.toEqual(result);
    expect(paypalAdapter.processRefund).toHaveBeenCalledWith({
      transactionId: 'tx-1',
      amount: 5,
      reason: 'duplicate',
    });
    expect(stripeAdapter.processRefund).not.toHaveBeenCalled();
  });

  it('throws when refund provider is missing', async () => {
    await expect(
      service.processRefund({ transactionId: 'tx-1' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('routes verification to the selected provider adapter', async () => {
    const result = { success: true, transactionId: 'stripe_123' };
    stripeAdapter.verifyTransaction.mockResolvedValue(result as never);

    await expect(service.verifyTransaction('stripe_123', PaymentProvider.STRIPE)).resolves.toEqual(result);
    expect(stripeAdapter.verifyTransaction).toHaveBeenCalledWith('stripe_123');
  });

  it('throws when verification provider is missing', async () => {
    await expect(service.verifyTransaction('tx-1', undefined as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('exposes available providers from the adapter registry', () => {
    expect(service.getAvailableProviders()).toEqual(['stripe', 'paypal']);
  });
});
