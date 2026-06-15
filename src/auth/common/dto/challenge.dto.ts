import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChallengeDto {
  @ApiProperty({ example: 'GABCD1234...' })
  @IsString()
  @IsNotEmpty()
  publicKey!: string;
}
