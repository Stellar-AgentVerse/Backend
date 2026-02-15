import { IPaymentAdapter } from './interface/payment-adapter.interface';
import { PaymentRequest } from '../common/interfaces/payment-request.interface';
import { PaymentResult } from '../common/interfaces/payment-result.interface';
import { RefundRequest } from '../common/interfaces/refund-request.interface';

/**
 * Clase base abstracta para los adapters de pago.
 * Proporciona funcionalidad común y estructura para todos los proveedores.
 */
export abstract class BasePaymentAdapter implements IPaymentAdapter {
  protected readonly providerName: string;

  constructor(providerName: string) {
    this.providerName = providerName;
  }

  getProviderName(): string {
    return this.providerName;
  }

  abstract processPayment(request: PaymentRequest): Promise<PaymentResult>;
  abstract processRefund(request: RefundRequest): Promise<PaymentResult>;
  abstract verifyTransaction(transactionId: string): Promise<PaymentResult>;
  abstract isConfigured(): boolean;

  /**
   * Método helper para crear una respuesta de éxito
   */
  protected createSuccessResult(
    transactionId: string,
    amount: number,
    currency: string,
    metadata?: Record<string, any>,
  ): PaymentResult {
    return {
      success: true,
      transactionId,
      amount,
      currency,
      provider: this.providerName,
      timestamp: new Date(),
      metadata,
    };
  }

  /**
   * Método helper para crear una respuesta de error
   */
  protected createErrorResult(
    error: string,
    transactionId?: string,
  ): PaymentResult {
    return {
      success: false,
      transactionId: transactionId || 'N/A',
      amount: 0,
      currency: 'N/A',
      provider: this.providerName,
      timestamp: new Date(),
      error,
    };
  }
}
