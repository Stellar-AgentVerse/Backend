import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentProvider } from './common/interfaces/payment-request.interface';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let paymentsService: jest.Mocked<PaymentsService>;

  beforeEach(async () => {
    const paymentsServiceMock = {
      processPayment: jest.fn(),
      processRefund: jest.fn(),
      verifyTransaction: jest.fn(),
      getAvailableProviders: jest.fn(),
    } as unknown as jest.Mocked<PaymentsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: paymentsServiceMock }],
    }).compile();

    controller = module.get(PaymentsController);
    paymentsService = module.get(PaymentsService) as jest.Mocked<PaymentsService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delegates createPayment to PaymentsService', async () => {
    const dto = { amount: 10, currency: 'USD', provider: PaymentProvider.STRIPE };
    const result = { success: true };
    paymentsService.processPayment.mockResolvedValue(result as never);

    await expect(controller.createPayment(dto as never)).resolves.toEqual(result);
    expect(paymentsService.processPayment).toHaveBeenCalledWith(dto, PaymentProvider.STRIPE);
  });

  it('delegates createRefund to PaymentsService', async () => {
    const dto = { transactionId: 'tx-1', provider: PaymentProvider.PAYPAL };
    const result = { success: true };
    paymentsService.processRefund.mockResolvedValue(result as never);

    await expect(controller.createRefund(dto as never)).resolves.toEqual(result);
    expect(paymentsService.processRefund).toHaveBeenCalledWith(dto, PaymentProvider.PAYPAL);
  });

  it('defaults verifyTransaction to Stripe when provider is missing', async () => {
    const result = { success: true };
    paymentsService.verifyTransaction.mockResolvedValue(result as never);

    await expect(controller.verifyTransaction('tx-1')).resolves.toEqual(result);
    expect(paymentsService.verifyTransaction).toHaveBeenCalledWith('tx-1', PaymentProvider.STRIPE);
  });

  it('delegates getProviders to PaymentsService', () => {
    paymentsService.getAvailableProviders.mockReturnValue(['stripe', 'paypal']);

    expect(controller.getProviders()).toEqual({ providers: ['stripe', 'paypal'] });
    expect(paymentsService.getAvailableProviders).toHaveBeenCalledTimes(1);
  });
});
