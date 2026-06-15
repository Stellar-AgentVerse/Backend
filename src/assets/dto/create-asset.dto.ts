import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';
import { AssetType } from '../../database/entities';

export class CreateAssetDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsEnum(AssetType)
  type: AssetType;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
