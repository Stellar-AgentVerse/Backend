import { Injectable } from '@nestjs/common';
import { CreatePaymentDto } from '../common/dto/create-payment.dto';
import { CreateRefundDto } from '../common/dto/create-refund.dto';
import { StripeAdapter } from '../adapters/stripe.adapter';
import { PaymentProvider } from '../common/interfaces/payment-request.interface';

@Injectable()
export class StripeService {
  constructor(private readonly stripeAdapter: StripeAdapter) {}

  async create(createPaymentDto: CreatePaymentDto) {
    return this.stripeAdapter.processPayment({
      amount: createPaymentDto.amount,
      currency: createPaymentDto.currency,
      description: createPaymentDto.description,
      customer: createPaymentDto.customer,
      metadata: createPaymentDto.metadata,
      provider: PaymentProvider.STRIPE,
    });
  }

  async refund(createRefundDto: CreateRefundDto) {
    return this.stripeAdapter.processRefund({
      transactionId: createRefundDto.transactionId,
      amount: createRefundDto.amount,
      reason: createRefundDto.reason,
    });
  }
}
