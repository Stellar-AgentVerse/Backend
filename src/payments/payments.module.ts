import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeAdapter } from './adapters/stripe.adapter';
import { PayPalAdapter } from './adapters/paypal.adapter';
import { MockPaymentAdapter } from './adapters/mock-payment.adapter';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    StripeAdapter,
    PayPalAdapter,
    MockPaymentAdapter,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
