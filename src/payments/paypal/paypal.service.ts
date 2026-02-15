import { Injectable } from '@nestjs/common';
import { CreatePaymentDto } from '../common/dto/create-payment.dto';
import { CreateRefundDto } from '../common/dto/create-refund.dto';
import { PayPalAdapter } from '../adapters/paypal.adapter';
import { PaymentProvider } from '../common/interfaces/payment-request.interface';

@Injectable()
export class PaypalService {
  constructor(private readonly paypalAdapter: PayPalAdapter) {}

  async create(createPaymentDto: CreatePaymentDto) {
    return this.paypalAdapter.processPayment({
      amount: createPaymentDto.amount,
      currency: createPaymentDto.currency,
      description: createPaymentDto.description,
      customer: createPaymentDto.customer,
      metadata: createPaymentDto.metadata,
      provider: PaymentProvider.PAYPAL,
    });
  }

  async refund(createRefundDto: CreateRefundDto) {
    return this.paypalAdapter.processRefund({
      transactionId: createRefundDto.transactionId,
      amount: createRefundDto.amount,
      reason: createRefundDto.reason,
    });
  }
}
