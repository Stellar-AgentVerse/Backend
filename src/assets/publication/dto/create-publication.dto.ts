import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePublicationDto {
  /**
   * Price in atomic units, sent as a string. The contract takes an `i128`,
   * whose range exceeds what a JSON number can carry exactly.
   */
  @ApiProperty({
    example: '500',
    description:
      'Immutable price in atomic units. Positive integer as a string, within the i128 range.',
  })
  @IsString()
  @Matches(/^[1-9][0-9]{0,38}$/, {
    message: 'priceAtomic must be a positive integer in atomic units',
  })
  priceAtomic: string;
}
