import { Injectable, Logger } from '@nestjs/common';
import { BasePaymentAdapter } from './base-payment.adapter';
import { PaymentRequest } from '../common/interfaces/payment-request.interface';
import { PaymentResult } from '../common/interfaces/payment-result.interface';
import { RefundRequest } from '../common/interfaces/refund-request.interface';

/**
 * Ejemplo de un adapter personalizado para demostrar la extensibilidad del sistema.
 * Este es un adapter mock que puede usarse para testing o desarrollo.
 * 
 * Para activar este adapter:
 * 1. Agregar MockPaymentAdapter a los providers en payments.module.ts
 * 2. Registrarlo en el factory PAYMENT_ADAPTERS_SETUP
 * 3. Configurar MOCK_PAYMENT_ENABLED=true en variables de entorno
 */
@Injectable()
export class MockPaymentAdapter extends BasePaymentAdapter {
  private readonly logger = new Logger(MockPaymentAdapter.name);
  private readonly isEnabled: boolean;
  private readonly shouldFail: boolean;

  constructor() {
    super('mock');
    this.isEnabled = process.env.MOCK_PAYMENT_ENABLED === 'true';
    this.shouldFail = process.env.MOCK_PAYMENT_FAIL === 'true';
  }

  isConfigured(): boolean {
    return this.isEnabled;
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    this.logger.log(`[MOCK] Procesando pago: ${JSON.stringify(request)}`);

    // Simular delay de red
    await this.delay(500);

    if (this.shouldFail) {
      return this.createErrorResult('Mock payment configured to fail');
    }

    const transactionId = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return this.createSuccessResult(
      transactionId,
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
    this.logger.log(`[MOCK] Procesando reembolso: ${JSON.stringify(request)}`);

    await this.delay(500);

    if (this.shouldFail) {
      return this.createErrorResult('Mock refund configured to fail', request.transactionId);
    }

    const refundId = `mock_refund_${Date.now()}`;

    return this.createSuccessResult(
      refundId,
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
    this.logger.log(`[MOCK] Verificando transacción: ${transactionId}`);

    await this.delay(300);

    if (this.shouldFail) {
      return this.createErrorResult('Mock verification configured to fail', transactionId);
    }

    return this.createSuccessResult(
      transactionId,
      0,
      'USD',
      {
        status: 'verified',
        mockNote: 'This is a simulated verification for testing purposes',
        verified: true,
      },
    );
  }

  /**
   * Helper para simular delay de red
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
