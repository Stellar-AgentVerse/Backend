import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Address, StrKey, nativeToScVal } from '@stellar/stellar-sdk';
import { sorobanConfig } from './config/soroban.config';
import { SorobanTxService } from './soroban-tx.service';

@Injectable()
export class TokensService {
  private readonly logger = new Logger(TokensService.name);

  constructor(
    @Inject(sorobanConfig.KEY)
    private readonly config: {
      contracts: { tokenMint: string; tokenSale: string };
    },
    private readonly tx: SorobanTxService,
  ) {}

  /**
   * Invoca el contrato de minteo de tokens (firmado por el admin).
   * @param to Dirección de destino (Stellar Address)
   * @param amount Cantidad a mintear
   */
  async mintTokens(to: string, amount: string) {
    const contractId = this.config.contracts.tokenMint;
    this.assertContractConfigured(contractId, 'tokenMint');

    this.logger.log(`Invocando Contrato Mint (${contractId}) -> mint(to: ${to}, amount: ${amount})`);

    const result = await this.tx.invokeContract({
      contractId,
      method: 'mint',
      args: [Address.fromString(to).toScVal(), nativeToScVal(amount, { type: 'i128' })],
    });

    return { ...result, operation: 'mint', to, amount };
  }

  /**
   * Invoca el contrato de venta de tokens (firmado por el admin).
   * @param seller Vendedor
   * @param amount Cantidad
   * @param price Precio
   */
  async sellTokens(seller: string, amount: string, price: string) {
    const contractId = this.config.contracts.tokenSale;
    this.assertContractConfigured(contractId, 'tokenSale');

    this.logger.log(
      `Invocando Contrato Venta (${contractId}) -> sell(seller: ${seller}, amount: ${amount}, price: ${price})`,
    );

    const result = await this.tx.invokeContract({
      contractId,
      method: 'sell',
      args: [
        Address.fromString(seller).toScVal(),
        nativeToScVal(amount, { type: 'i128' }),
        nativeToScVal(price, { type: 'i128' }),
      ],
    });

    return { ...result, operation: 'sell', seller, amount, price };
  }

  private assertContractConfigured(contractId: string, label: string): void {
    if (!contractId || !StrKey.isValidContract(contractId)) {
      this.logger.warn(`El ID del contrato '${label}' no está configurado o es inválido.`);
      throw new ServiceUnavailableException(`${label} contract not configured`);
    }
  }
}
