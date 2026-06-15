import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import {
  Wallet,
  CreditPackage,
  WalletTransaction,
} from '../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, CreditPackage, WalletTransaction]),
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
