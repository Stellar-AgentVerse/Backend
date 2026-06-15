import { IsString, IsNotEmpty } from 'class-validator';

export class ChallengeDto {
  @IsString()
  @IsNotEmpty()
  publicKey!: string;
}
