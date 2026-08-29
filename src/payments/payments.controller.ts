import { Controller, Post, Body, Get, Param, Query, Logger, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a payment (JWT required)' })
    @ApiResponse({ status: 401, description: 'Missing, malformed or expired token' })
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
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a refund (JWT required)' })
    @ApiResponse({ status: 401, description: 'Missing, malformed or expired token' })
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
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Verify a payment transaction (JWT required)' })
    @ApiResponse({ status: 401, description: 'Missing, malformed or expired token' })
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
     * Obtener proveedores de pago disponibles.
     * Public capability probe: an empty list means no provider can currently
     * process a payment, which is the expected state in any deployment.
     */
    @Get('providers')
    @ApiOperation({ summary: 'List payment providers that are currently usable' })
    getProviders(): { providers: string[] } {
        const providers = this.paymentsService.getAvailableProviders();
        return { providers };
    }
}
