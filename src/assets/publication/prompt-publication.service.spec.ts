import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  Asset,
  AssetType,
  PromptPublication,
  PromptPublicationState,
} from '../../database/entities';
import { PromptPublicationService } from './prompt-publication.service';

const CREATOR = 'GCREATOR';
const OTHER = 'GSOMEONEELSE';
const ASSET_ID = '11111111-1111-1111-1111-111111111111';

const VALID_EVIDENCE = {
  commitment: 'a'.repeat(64),
  contractId: 'C' + 'A'.repeat(55),
  transactionHash: 'b'.repeat(64),
  ledgerSequence: '1234567',
};

describe('PromptPublicationService', () => {
  let service: PromptPublicationService;
  let publicationRepo: jest.Mocked<Repository<PromptPublication>>;
  let assetRepo: jest.Mocked<Repository<Asset>>;
  let execute: jest.Mock;
  let setSpy: jest.Mock;
  let assetFindOne: jest.Mock;
  let publicationFindOne: jest.Mock;

  const promptAsset = (overrides: Partial<Asset> = {}): Asset =>
    ({
      id: ASSET_ID,
      type: AssetType.PROMPT,
      creatorPublicKey: CREATOR,
      ...overrides,
    }) as Asset;

  const publication = (
    overrides: Partial<PromptPublication> = {},
  ): PromptPublication =>
    ({
      id: '22222222-2222-2222-2222-222222222222',
      assetId: ASSET_ID,
      state: PromptPublicationState.DRAFT,
      priceAtomic: '500',
      commitmentVersion: 1,
      commitment: null,
      network: 'testnet',
      contractId: null,
      transactionHash: null,
      ledgerSequence: null,
      attempts: 0,
      ...overrides,
    }) as PromptPublication;

  beforeEach(async () => {
    execute = jest.fn().mockResolvedValue({ affected: 1 });
    setSpy = jest.fn().mockReturnThis();

    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: setSpy,
      where: jest.fn().mockReturnThis(),
      execute,
    };

    publicationFindOne = jest.fn();
    assetFindOne = jest.fn();

    publicationRepo = {
      findOne: publicationFindOne,
      create: jest.fn((value: Partial<PromptPublication>) => value),
      save: jest.fn((value: Partial<PromptPublication>) => value),
      createQueryBuilder: jest.fn(() => queryBuilder),
    } as unknown as jest.Mocked<Repository<PromptPublication>>;

    assetRepo = {
      findOne: assetFindOne,
    } as unknown as jest.Mocked<Repository<Asset>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptPublicationService,
        {
          provide: getRepositoryToken(PromptPublication),
          useValue: publicationRepo,
        },
        { provide: getRepositoryToken(Asset), useValue: assetRepo },
        { provide: ConfigService, useValue: { get: () => 'testnet' } },
      ],
    }).compile();

    service = module.get(PromptPublicationService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('rejects an unknown asset', async () => {
      assetRepo.findOne.mockResolvedValue(null);
      await expect(service.create(ASSET_ID, CREATOR, '500')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a caller who does not own the asset', async () => {
      assetRepo.findOne.mockResolvedValue(promptAsset());
      await expect(service.create(ASSET_ID, OTHER, '500')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects an asset that is not a PROMPT', async () => {
      assetRepo.findOne.mockResolvedValue(
        promptAsset({ type: AssetType.AGENT }),
      );
      await expect(service.create(ASSET_ID, CREATOR, '500')).rejects.toThrow(
        BadRequestException,
      );
    });

    it.each(['0', '-1', 'abc', '', '1.5', '01'])(
      'rejects the invalid atomic price %p',
      async (price) => {
        assetRepo.findOne.mockResolvedValue(promptAsset());
        await expect(service.create(ASSET_ID, CREATOR, price)).rejects.toThrow(
          BadRequestException,
        );
      },
    );

    it('rejects a price above the i128 range', async () => {
      assetRepo.findOne.mockResolvedValue(promptAsset());
      const tooBig = '170141183460469231731687303715884105728';
      await expect(service.create(ASSET_ID, CREATOR, tooBig)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('accepts the largest i128 price', async () => {
      assetRepo.findOne.mockResolvedValue(promptAsset());
      publicationRepo.findOne.mockResolvedValue(null);
      const max = '170141183460469231731687303715884105727';
      const created = await service.create(ASSET_ID, CREATOR, max);
      expect(created.priceAtomic).toBe(max);
      expect(created.state).toBe(PromptPublicationState.DRAFT);
    });

    it('rejects a second publication for the same asset', async () => {
      assetRepo.findOne.mockResolvedValue(promptAsset());
      publicationRepo.findOne.mockResolvedValue(publication());
      await expect(service.create(ASSET_ID, CREATOR, '500')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('submit', () => {
    it('moves a draft into review', async () => {
      assetRepo.findOne.mockResolvedValue(promptAsset());
      publicationRepo.findOne
        .mockResolvedValueOnce(publication())
        .mockResolvedValueOnce(
          publication({ state: PromptPublicationState.PENDING_REVIEW }),
        );

      const result = await service.submit(ASSET_ID, CREATOR);

      expect(result.state).toBe(PromptPublicationState.PENDING_REVIEW);
      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          state: PromptPublicationState.PENDING_REVIEW,
        }),
      );
    });

    it('rejects a submit from a state that is not DRAFT', async () => {
      assetRepo.findOne.mockResolvedValue(promptAsset());
      publicationRepo.findOne.mockResolvedValue(
        publication({ state: PromptPublicationState.PUBLISHING }),
      );
      await expect(service.submit(ASSET_ID, CREATOR)).rejects.toThrow(
        ConflictException,
      );
    });

    it('rejects a submit from someone other than the creator', async () => {
      assetRepo.findOne.mockResolvedValue(promptAsset());
      await expect(service.submit(ASSET_ID, OTHER)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('fails when the row was advanced concurrently', async () => {
      assetRepo.findOne.mockResolvedValue(promptAsset());
      publicationRepo.findOne.mockResolvedValue(publication());
      execute.mockResolvedValue({ affected: 0 });

      await expect(service.submit(ASSET_ID, CREATOR)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('review', () => {
    it('approves a submitted draft into PUBLISHING', async () => {
      publicationRepo.findOne
        .mockResolvedValueOnce(
          publication({ state: PromptPublicationState.PENDING_REVIEW }),
        )
        .mockResolvedValueOnce(
          publication({ state: PromptPublicationState.PUBLISHING }),
        );

      const result = await service.review(ASSET_ID, 'GOPERATOR', true);

      expect(result.state).toBe(PromptPublicationState.PUBLISHING);
      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({ reviewerPublicKey: 'GOPERATOR' }),
      );
    });

    it('returns a rejected draft to the creator', async () => {
      publicationRepo.findOne
        .mockResolvedValueOnce(
          publication({ state: PromptPublicationState.PENDING_REVIEW }),
        )
        .mockResolvedValueOnce(publication());

      const result = await service.review(ASSET_ID, 'GOPERATOR', false, 'nope');

      expect(result.state).toBe(PromptPublicationState.DRAFT);
      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          failureCode: 'REVIEW_REJECTED',
          failureDetail: 'nope',
        }),
      );
    });

    it('cannot approve something that was never submitted', async () => {
      publicationRepo.findOne.mockResolvedValue(publication());
      await expect(service.review(ASSET_ID, 'GOPERATOR', true)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('markPublished', () => {
    const publishing = () =>
      publication({ state: PromptPublicationState.PUBLISHING });

    it.each([
      ['commitment', { ...VALID_EVIDENCE, commitment: 'not-hex' }],
      ['contractId', { ...VALID_EVIDENCE, contractId: 'GNOTACONTRACT' }],
      ['transactionHash', { ...VALID_EVIDENCE, transactionHash: '' }],
      ['ledgerSequence', { ...VALID_EVIDENCE, ledgerSequence: '0' }],
    ])('rejects incomplete evidence: %s', async (_field, evidence) => {
      publicationRepo.findOne.mockResolvedValue(publishing());
      await expect(service.markPublished(ASSET_ID, evidence)).rejects.toThrow(
        BadRequestException,
      );
      expect(execute).not.toHaveBeenCalled();
    });

    it('records full evidence and publishes', async () => {
      publicationRepo.findOne
        .mockResolvedValueOnce(publishing())
        .mockResolvedValueOnce(
          publication({
            state: PromptPublicationState.PUBLISHED,
            ...VALID_EVIDENCE,
          }),
        );

      const result = await service.markPublished(ASSET_ID, VALID_EVIDENCE);

      expect(result.state).toBe(PromptPublicationState.PUBLISHED);
      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining(VALID_EVIDENCE),
      );
    });

    it('refuses to rebind a commitment that was already recorded', async () => {
      publicationRepo.findOne.mockResolvedValue(
        publication({
          state: PromptPublicationState.PUBLISHING,
          commitment: 'c'.repeat(64),
        }),
      );

      await expect(
        service.markPublished(ASSET_ID, VALID_EVIDENCE),
      ).rejects.toThrow(ConflictException);
      expect(execute).not.toHaveBeenCalled();
    });

    it('cannot publish twice: PUBLISHED is terminal', async () => {
      publicationRepo.findOne.mockResolvedValue(
        publication({
          state: PromptPublicationState.PUBLISHED,
          ...VALID_EVIDENCE,
        }),
      );

      await expect(
        service.markPublished(ASSET_ID, VALID_EVIDENCE),
      ).rejects.toThrow(ConflictException);
      expect(execute).not.toHaveBeenCalled();
    });
  });

  describe('markFailed', () => {
    it('increments attempts without touching the binding', async () => {
      publicationRepo.findOne
        .mockResolvedValueOnce(
          publication({ state: PromptPublicationState.PUBLISHING }),
        )
        .mockResolvedValueOnce(
          publication({ state: PromptPublicationState.FAILED, attempts: 1 }),
        );

      const result = await service.markFailed(ASSET_ID, 'RPC_TIMEOUT');

      expect(result.state).toBe(PromptPublicationState.FAILED);
      expect(result.attempts).toBe(1);
      const calls = setSpy.mock.calls as Array<[Record<string, unknown>]>;
      const patch = calls[0][0];
      expect(patch.priceAtomic).toBeUndefined();
      expect(patch.commitment).toBeUndefined();
    });

    it('rejects a failure recorded from a state that was not PUBLISHING', async () => {
      publicationRepo.findOne.mockResolvedValue(publication());
      await expect(service.markFailed(ASSET_ID, 'RPC_TIMEOUT')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findForActor', () => {
    it('lets an operator read any publication', async () => {
      publicationRepo.findOne.mockResolvedValue(publication());
      await expect(
        service.findForActor(ASSET_ID, 'GOPERATOR', true),
      ).resolves.toMatchObject({ assetId: ASSET_ID });
      expect(assetFindOne).not.toHaveBeenCalled();
    });

    it('lets the creator read their own publication', async () => {
      publicationRepo.findOne.mockResolvedValue(publication());
      assetRepo.findOne.mockResolvedValue(promptAsset());
      await expect(
        service.findForActor(ASSET_ID, CREATOR, false),
      ).resolves.toMatchObject({ assetId: ASSET_ID });
    });

    it('hides a publication from an unrelated caller', async () => {
      publicationRepo.findOne.mockResolvedValue(publication());
      assetRepo.findOne.mockResolvedValue(promptAsset());
      await expect(
        service.findForActor(ASSET_ID, OTHER, false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('404s when there is no publication for the asset', async () => {
      publicationRepo.findOne.mockResolvedValue(null);
      await expect(
        service.findForActor(ASSET_ID, CREATOR, true),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
