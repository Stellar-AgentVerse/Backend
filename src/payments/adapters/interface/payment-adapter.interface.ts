import { PaymentRequest } from '../../common/interfaces/payment-request.interface';
import { PaymentResult } from '../../common/interfaces/payment-result.interface';
import { RefundRequest } from '../../common/interfaces/refund-request.interface';

export interface IPaymentAdapter {
  /**
   * Nombre único del proveedor de pago
   */
  getProviderName(): string;

  /**
   * Procesar un pago
   */
  processPayment(request: PaymentRequest): Promise<PaymentResult>;

  /**
   * Procesar un reembolso
   */
  processRefund(request: RefundRequest): Promise<PaymentResult>;

  /**
   * Verificar el estado de una transacción
   */
  verifyTransaction(transactionId: string): Promise<PaymentResult>;

  /**
   * Validar si el adapter está correctamente configurado
   */
  isConfigured(): boolean;
}
