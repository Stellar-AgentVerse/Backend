export interface PaymentResult {
  success: boolean;
  transactionId: string;
  amount: number;
  currency: string;
  provider: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  error?: string;
}
