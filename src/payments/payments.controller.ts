import { Controller, Post, Body, Get, Param, Query, Patch, Logger } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './common/dto/create-payment.dto';
import { CreateRefundDto } from './common/dto/create-refund.dto';
import { PaymentResult } from './common/interfaces/payment-result.interface';
import { PaymentProvider } from './common/interfaces/payment-request.interface';

@Controller('payments')
export class PaymentsController {
    private readonly logger = new Logger(PaymentsController.name);

    constructor(private readonly paymentsService: PaymentsService) { }

    /**
     * Procesar un nuevo pago
     */
    @Post()
    async createPayment(
        @Body() createPaymentDto: CreatePaymentDto,
    ): Promise<PaymentResult> {
        this.logger.log('Solicitud de nuevo pago recibida');
        return this.paymentsService.processPayment(
            createPaymentDto,
            createPaymentDto.provider,
        );
    }

    /**
     * Procesar un reembolso
     */
    @Post('refund')
    async createRefund(
        @Body() createRefundDto: CreateRefundDto,
    ): Promise<PaymentResult> {
        this.logger.log('Solicitud de reembolso recibida');
        return this.paymentsService.processRefund(
            createRefundDto,
            createRefundDto.provider,
        );
    }

    /**
     * Verificar el estado de una transacción
     */
    @Get('verify/:transactionId')
    async verifyTransaction(
        @Param('transactionId') transactionId: string,
        @Query('provider') provider?: string,
    ): Promise<PaymentResult> {
        this.logger.log(`Verificando transacción ${transactionId}`);
        return this.paymentsService.verifyTransaction(transactionId, provider ?? PaymentProvider.STRIPE);
    }

    /**
     * Obtener proveedores de pago disponibles
     */
    @Get('providers')
    getProviders(): { providers: string[] } {
        const providers = this.paymentsService.getAvailableProviders();
        return { providers };
    }
}
