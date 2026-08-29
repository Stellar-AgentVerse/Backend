import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BasePaymentAdapter } from './base-payment.adapter';
import { PaymentRequest } from '../common/interfaces/payment-request.interface';
import { PaymentResult } from '../common/interfaces/payment-result.interface';
import { RefundRequest } from '../common/interfaces/refund-request.interface';

/**
 * There is no Stripe SDK in this project and no network call anywhere below:
 * this adapter has only ever fabricated its results. Previously a non-empty
 * `STRIPE_API_KEY` was enough to make it report `success: true` with an
 * invented transaction id, which meant a deployment that merely *looked*
 * configured produced fake money movement.
 *
 * It now runs only when payment simulation is explicitly enabled, which
 * `validateEnv` permits only when `NODE_ENV` is `development` or `test`.
 *
 * The methods are not `async` because none of them awaits anything — which is
 * precisely the point: no provider is ever contacted.
 */
@Injectable()
export class StripeAdapter extends BasePaymentAdapter {
  private readonly logger = new Logger(StripeAdapter.name);
  private readonly apiKey: string;
  private readonly simulationEnabled: boolean;

  constructor(configService: ConfigService) {
    super('stripe');
    this.apiKey = process.env.STRIPE_API_KEY || '';
    this.simulationEnabled =
      configService.get<boolean>('payments.simulationEnabled') === true;
  }

  isConfigured(): boolean {
    return this.simulationEnabled && !!this.apiKey;
  }

  /** Null when the adapter may proceed; otherwise the refusal to return. */
  private refusal(transactionId?: string): PaymentResult | null {
    if (!this.simulationEnabled) {
      return this.createSimulationDisabledResult(transactionId);
    }
    if (!this.apiKey) {
      return this.createErrorResult(
        'Stripe no está configurado',
        transactionId,
      );
    }
    return null;
  }

  processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const refused = this.refusal();
    if (refused) return Promise.resolve(refused);

    this.logger.warn(
      `[SIMULATED] Procesando pago con Stripe por ${request.amount} ${request.currency}`,
    );

    return Promise.resolve(
      this.createSimulatedResult(
        `stripe_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        request.amount,
        request.currency,
        {
          description: request.description,
          customer: request.customer,
          rawResponse: 'Stripe payment simulated',
        },
      ),
    );
  }

  processRefund(request: RefundRequest): Promise<PaymentResult> {
    const refused = this.refusal(request.transactionId);
    if (refused) return Promise.resolve(refused);

    this.logger.warn(
      `[SIMULATED] Procesando reembolso con Stripe: ${request.transactionId}`,
    );

    return Promise.resolve(
      this.createSimulatedResult(
        `stripe_refund_${Date.now()}`,
        request.amount || 0,
        'USD',
        {
          originalTransaction: request.transactionId,
          reason: request.reason,
          rawResponse: 'Stripe refund simulated',
        },
      ),
    );
  }

  verifyTransaction(transactionId: string): Promise<PaymentResult> {
    const refused = this.refusal(transactionId);
    if (refused) return Promise.resolve(refused);

    this.logger.warn(
      `[SIMULATED] Verificando transacción Stripe: ${transactionId}`,
    );

    return Promise.resolve(
      this.createSuccessResult(transactionId, 0, 'USD', {
        status: 'verified',
        rawResponse: 'Stripe verification simulated',
        simulated: true,
      }),
    );
  }
}
