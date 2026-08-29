import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BasePaymentAdapter } from './base-payment.adapter';
import { PaymentRequest } from '../common/interfaces/payment-request.interface';
import { PaymentResult } from '../common/interfaces/payment-result.interface';
import { RefundRequest } from '../common/interfaces/refund-request.interface';

/**
 * Ejemplo de un adapter personalizado para demostrar la extensibilidad del sistema.
 * Este es un adapter mock que puede usarse para testing o desarrollo.
 *
 * Enabled by `MOCK_PAYMENT_ENABLED=true` (or `PAYMENT_SIMULATION_ENABLED=true`),
 * which `validateEnv` accepts only when `NODE_ENV` is `development` or `test`.
 * Outside those environments the application refuses to boot with the flag set,
 * and this adapter refuses to fabricate a result regardless.
 */
@Injectable()
export class MockPaymentAdapter extends BasePaymentAdapter {
  private readonly logger = new Logger(MockPaymentAdapter.name);
  private readonly simulationEnabled: boolean;
  private readonly shouldFail: boolean;

  constructor(configService: ConfigService) {
    super('mock');
    this.simulationEnabled =
      configService.get<boolean>('payments.simulationEnabled') === true;
    this.shouldFail = process.env.MOCK_PAYMENT_FAIL === 'true';
  }

  isConfigured(): boolean {
    return this.simulationEnabled;
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    if (!this.simulationEnabled) {
      return this.createSimulationDisabledResult();
    }

    this.logger.warn(`[MOCK] Procesando pago: ${JSON.stringify(request)}`);

    // Simular delay de red
    await this.delay(500);

    if (this.shouldFail) {
      return this.createErrorResult('Mock payment configured to fail');
    }

    return this.createSimulatedResult(
      `mock_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      request.amount,
      request.currency,
      {
        description: request.description,
        customer: request.customer,
        mockNote: 'This is a simulated payment for testing purposes',
      },
    );
  }

  async processRefund(request: RefundRequest): Promise<PaymentResult> {
    if (!this.simulationEnabled) {
      return this.createSimulationDisabledResult(request.transactionId);
    }

    this.logger.warn(`[MOCK] Procesando reembolso: ${JSON.stringify(request)}`);

    await this.delay(500);

    if (this.shouldFail) {
      return this.createErrorResult(
        'Mock refund configured to fail',
        request.transactionId,
      );
    }

    return this.createSimulatedResult(
      `mock_refund_${Date.now()}`,
      request.amount || 0,
      'USD',
      {
        originalTransaction: request.transactionId,
        reason: request.reason,
        mockNote: 'This is a simulated refund for testing purposes',
      },
    );
  }

  async verifyTransaction(transactionId: string): Promise<PaymentResult> {
    if (!this.simulationEnabled) {
      return this.createSimulationDisabledResult(transactionId);
    }

    this.logger.warn(`[MOCK] Verificando transacción: ${transactionId}`);

    await this.delay(300);

    if (this.shouldFail) {
      return this.createErrorResult(
        'Mock verification configured to fail',
        transactionId,
      );
    }

    return this.createSuccessResult(transactionId, 0, 'USD', {
      status: 'verified',
      mockNote: 'This is a simulated verification for testing purposes',
      verified: true,
      simulated: true,
    });
  }

  /**
   * Helper para simular delay de red
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
