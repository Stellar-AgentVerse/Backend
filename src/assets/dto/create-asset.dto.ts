import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssetType } from '../../database/entities';

export class CreateAssetDto {
  @ApiProperty({ example: 'My AI Agent' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: AssetType, example: AssetType.AGENT })
  @IsEnum(AssetType)
  type: AssetType;

  @ApiPropertyOptional({ example: 'A useful autonomous agent' })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 25 })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({ example: ['featured', 'stable'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
