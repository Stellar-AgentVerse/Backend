import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyWalletDto {
  @IsString()
  @IsNotEmpty()
  publicKey!: string;

  @IsString()
  @IsNotEmpty()
  signature!: string;
}
