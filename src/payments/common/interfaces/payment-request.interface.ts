export enum PaymentProvider {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  description?: string;
  customer?: {
    email?: string;
    name?: string;
  };
  provider: PaymentProvider;
  metadata?: Record<string, any>;
}
