import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CreatePaymentDto } from './common/dto/create-payment.dto';
import { CreateRefundDto } from './common/dto/create-refund.dto';
import { PaymentResult } from './common/interfaces/payment-result.interface';
import { IPaymentAdapter } from './adapters/interface/payment-adapter.interface';
import { PaymentProvider } from './common/interfaces/payment-request.interface';
import { StripeAdapter } from './adapters/stripe.adapter';
import { PayPalAdapter } from './adapters/paypal.adapter';
import { MockPaymentAdapter } from './adapters/mock-payment.adapter';

@Injectable()
export class PaymentsService {
  private adapters: Record<string, IPaymentAdapter>;

  constructor(
    private readonly stripeAdapter: StripeAdapter,
    private readonly paypalAdapter: PayPalAdapter,
    private readonly mockPaymentAdapter: MockPaymentAdapter,
  ) {
    this.adapters = {
      stripe: this.stripeAdapter,
      paypal: this.paypalAdapter,
      mock: this.mockPaymentAdapter,
    };
  }

  private getAdapter(provider: string): IPaymentAdapter {
    const adapter = this.adapters[provider];
    if (!adapter) {
      throw new BadRequestException(`El proveedor de pagos '${provider}' no es soportado.`);
    }
    if (!adapter.isConfigured()) {
      throw new ServiceUnavailableException(
        `El proveedor de pagos '${provider}' no está configurado para este entorno.`,
      );
    }
    return adapter;
  }

  async processPayment(createPaymentDto: CreatePaymentDto, provider?: string): Promise<PaymentResult> {
    const selectedProvider = provider || createPaymentDto.provider;
    
    if (!selectedProvider) {
      throw new BadRequestException('Se requiere especificar un proveedor de pagos.');
    }

    const adapter = this.getAdapter(selectedProvider);
    
    return adapter.processPayment({
      amount: createPaymentDto.amount,
      currency: createPaymentDto.currency,
      provider: selectedProvider as PaymentProvider,
      description: createPaymentDto.description,
      customer: createPaymentDto.customer,
      metadata: createPaymentDto.metadata,
    });
  }

  async processRefund(createRefundDto: CreateRefundDto, provider?: string): Promise<PaymentResult> {
    const selectedProvider = provider || createRefundDto.provider;

    if (!selectedProvider) {
      throw new BadRequestException('Se requiere especificar un proveedor para el reembolso.');
    }

    const adapter = this.getAdapter(selectedProvider);

    return adapter.processRefund({
      transactionId: createRefundDto.transactionId,
      amount: createRefundDto.amount,
      reason: createRefundDto.reason,
    });
  }

  /**
   * Only providers that are actually usable right now. Previously this listed
   * every registered adapter unconditionally, which advertised Stripe and
   * PayPal as available in a deployment where neither can process anything.
   */
  getAvailableProviders(): string[] {
    return Object.entries(this.adapters)
      .filter(([, adapter]) => adapter.isConfigured())
      .map(([name]) => name);
  }

  async verifyTransaction(transactionId: string, provider: string): Promise<PaymentResult> {
    if (!provider) {
       throw new BadRequestException('Se requiere el proveedor para verificar la transacción.');
    }
    const adapter = this.getAdapter(provider);
    return adapter.verifyTransaction(transactionId);
  }
}
