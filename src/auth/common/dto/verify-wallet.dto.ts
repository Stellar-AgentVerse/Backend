import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyWalletDto {
  @ApiProperty({ example: 'GABCD1234...' })
  @IsString()
  @IsNotEmpty()
  publicKey!: string;

  @ApiProperty({ example: 'deadbeefcafebabe' })
  @IsString()
  @IsNotEmpty()
  signature!: string;
}
