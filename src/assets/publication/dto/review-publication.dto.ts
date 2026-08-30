import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewPublicationDto {
  @ApiProperty({
    example: true,
    description:
      'Approve moves the draft to PUBLISHING; reject returns it to DRAFT.',
  })
  @IsBoolean()
  approve: boolean;

  @ApiPropertyOptional({
    example: 'Description does not match the prompt behaviour',
    description:
      'Reviewer note stored on rejection. Never include prompt content.',
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
