import { IPaymentAdapter } from './interface/payment-adapter.interface';
import { PaymentRequest } from '../common/interfaces/payment-request.interface';
import { PaymentResult } from '../common/interfaces/payment-result.interface';
import { RefundRequest } from '../common/interfaces/refund-request.interface';

/** Marks every identifier that was invented rather than returned by a provider. */
export const SIMULATED_ID_PREFIX = 'simulated_';

export const SIMULATION_DISABLED_ERROR =
  'Payment simulation is disabled. This adapter has no real provider integration, ' +
  'so it cannot process payments outside development and test.';

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
   * Success result for an adapter that invented the outcome. The identifier is
   * prefixed and the metadata is flagged so that a simulated result can never
   * be mistaken for a settled payment, in a log or in a database row.
   */
  protected createSimulatedResult(
    transactionId: string,
    amount: number,
    currency: string,
    metadata?: Record<string, any>,
  ): PaymentResult {
    return this.createSuccessResult(
      `${SIMULATED_ID_PREFIX}${transactionId}`,
      amount,
      currency,
      { ...metadata, simulated: true },
    );
  }

  /**
   * Refusal used when simulation is not permitted. It invents no identifier,
   * so nothing downstream can persist or display a fabricated reference.
   */
  protected createSimulationDisabledResult(
    transactionId?: string,
  ): PaymentResult {
    return this.createErrorResult(SIMULATION_DISABLED_ERROR, transactionId);
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
