import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PromptPublication,
  PromptPublicationState,
} from '../../../database/entities';

/**
 * Operational view of a publication. Carries lifecycle and on-chain evidence
 * only — prompt content and any key material stay out of responses by
 * construction, because the entity never holds them.
 */
export class PublicationResponseDto {
  @ApiProperty({ example: 'b9f0c1f0-0000-0000-0000-000000000000' })
  id: string;

  @ApiProperty({ example: 'b9f0c1f0-0000-0000-0000-000000000001' })
  assetId: string;

  @ApiProperty({ enum: PromptPublicationState })
  state: PromptPublicationState;

  @ApiProperty({ example: '500' })
  priceAtomic: string;

  @ApiProperty({ example: 1 })
  commitmentVersion: number;

  @ApiPropertyOptional({ example: null, nullable: true })
  commitment: string | null;

  @ApiProperty({ example: 'testnet' })
  network: string;

  @ApiPropertyOptional({ nullable: true })
  contractId: string | null;

  @ApiPropertyOptional({ nullable: true })
  transactionHash: string | null;

  @ApiPropertyOptional({ nullable: true })
  ledgerSequence: string | null;

  @ApiPropertyOptional({ nullable: true })
  reviewerPublicKey: string | null;

  @ApiPropertyOptional({ nullable: true })
  reviewedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  publishedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  failureCode: string | null;

  @ApiProperty({ example: 0 })
  attempts: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static from(publication: PromptPublication): PublicationResponseDto {
    return {
      id: publication.id,
      assetId: publication.assetId,
      state: publication.state,
      priceAtomic: publication.priceAtomic,
      commitmentVersion: publication.commitmentVersion,
      commitment: publication.commitment,
      network: publication.network,
      contractId: publication.contractId,
      transactionHash: publication.transactionHash,
      ledgerSequence: publication.ledgerSequence,
      reviewerPublicKey: publication.reviewerPublicKey,
      reviewedAt: publication.reviewedAt,
      publishedAt: publication.publishedAt,
      failureCode: publication.failureCode,
      attempts: publication.attempts,
      createdAt: publication.createdAt,
      updatedAt: publication.updatedAt,
    };
  }
}
