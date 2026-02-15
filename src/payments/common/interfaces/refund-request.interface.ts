export interface RefundRequest {
  transactionId: string;
  amount?: number;
  reason?: string;
}
