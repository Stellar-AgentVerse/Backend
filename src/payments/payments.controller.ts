import { Controller, Post, Body, Get, Param, Query, Logger } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './common/dto/create-payment.dto';
import { CreateRefundDto } from './common/dto/create-refund.dto';
import { PaymentResult } from './common/interfaces/payment-result.interface';
import { PaymentProvider } from './common/interfaces/payment-request.interface';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
    private readonly logger = new Logger(PaymentsController.name);

    constructor(private readonly paymentsService: PaymentsService) { }

    /**
     * Procesar un nuevo pago
     */
    @Post()
    @ApiOperation({ summary: 'Create a payment' })
    @ApiBody({ type: CreatePaymentDto })
    @ApiResponse({ status: 201, description: 'Payment processed', type: PaymentResult })
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
    @ApiOperation({ summary: 'Create a refund' })
    @ApiBody({ type: CreateRefundDto })
    @ApiResponse({ status: 201, description: 'Refund processed', type: PaymentResult })
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
    @ApiOperation({ summary: 'Verify a payment transaction' })
    @ApiParam({ name: 'transactionId', example: 'tx_123' })
    @ApiQuery({ name: 'provider', required: false, example: PaymentProvider.STRIPE })
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
    @ApiOperation({ summary: 'List available payment providers' })
    getProviders(): { providers: string[] } {
        const providers = this.paymentsService.getAvailableProviders();
        return { providers };
    }
}
