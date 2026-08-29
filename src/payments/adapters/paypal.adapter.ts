import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BasePaymentAdapter } from './base-payment.adapter';
import { PaymentRequest } from '../common/interfaces/payment-request.interface';
import { PaymentResult } from '../common/interfaces/payment-result.interface';
import { RefundRequest } from '../common/interfaces/refund-request.interface';

/**
 * Like the Stripe adapter, this has no SDK behind it and never reaches the
 * network — every result below is invented. It runs only when payment
 * simulation is explicitly enabled, which `validateEnv` permits only when
 * `NODE_ENV` is `development` or `test`.
 */
@Injectable()
export class PayPalAdapter extends BasePaymentAdapter {
  private readonly logger = new Logger(PayPalAdapter.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly simulationEnabled: boolean;
  private readonly environment: 'sandbox' | 'production';

  constructor(configService: ConfigService) {
    super('paypal');
    this.clientId = process.env.PAYPAL_CLIENT_ID || '';
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
    this.environment =
      (process.env.PAYPAL_ENV as 'sandbox' | 'production') || 'sandbox';
    this.simulationEnabled =
      configService.get<boolean>('payments.simulationEnabled') === true;
  }

  isConfigured(): boolean {
    return this.simulationEnabled && !!(this.clientId && this.clientSecret);
  }

  /** Null when the adapter may proceed; otherwise the refusal to return. */
  private refusal(transactionId?: string): PaymentResult | null {
    if (!this.simulationEnabled) {
      return this.createSimulationDisabledResult(transactionId);
    }
    if (!(this.clientId && this.clientSecret)) {
      return this.createErrorResult(
        'PayPal no está configurado',
        transactionId,
      );
    }
    return null;
  }

  processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const refused = this.refusal();
    if (refused) return Promise.resolve(refused);

    this.logger.warn(
      `[SIMULATED] Procesando pago con PayPal por ${request.amount} ${request.currency}`,
    );

    return Promise.resolve(
      this.createSimulatedResult(
        `paypal_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        request.amount,
        request.currency,
        {
          description: request.description,
          customer: request.customer,
          environment: this.environment,
          rawResponse: 'PayPal payment simulated',
        },
      ),
    );
  }

  processRefund(request: RefundRequest): Promise<PaymentResult> {
    const refused = this.refusal(request.transactionId);
    if (refused) return Promise.resolve(refused);

    this.logger.warn(
      `[SIMULATED] Procesando reembolso con PayPal: ${request.transactionId}`,
    );

    return Promise.resolve(
      this.createSimulatedResult(
        `paypal_refund_${Date.now()}`,
        request.amount || 0,
        'USD',
        {
          originalTransaction: request.transactionId,
          reason: request.reason,
          environment: this.environment,
          rawResponse: 'PayPal refund simulated',
        },
      ),
    );
  }

  verifyTransaction(transactionId: string): Promise<PaymentResult> {
    const refused = this.refusal(transactionId);
    if (refused) return Promise.resolve(refused);

    this.logger.warn(
      `[SIMULATED] Verificando transacción PayPal: ${transactionId}`,
    );

    return Promise.resolve(
      this.createSuccessResult(transactionId, 0, 'USD', {
        status: 'verified',
        environment: this.environment,
        rawResponse: 'PayPal verification simulated',
        simulated: true,
      }),
    );
  }
}
