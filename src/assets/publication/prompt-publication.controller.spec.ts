import { Test, TestingModule } from '@nestjs/testing';
import {
  PromptPublication,
  PromptPublicationState,
} from '../../database/entities';
import { OperatorRegistry } from '../../auth/operator.registry';
import { PromptPublicationController } from './prompt-publication.controller';
import { PromptPublicationService } from './prompt-publication.service';
import type { JwtPayload } from '../../auth/common/interfaces/jwt-payload.interface';

const ASSET_ID = '11111111-1111-1111-1111-111111111111';
const user: JwtPayload = { publicKey: 'GCREATOR', iat: 0 };

const row = (overrides: Partial<PromptPublication> = {}): PromptPublication =>
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
    submittedAt: null,
    reviewerPublicKey: null,
    reviewedAt: null,
    publishedAt: null,
    failureCode: null,
    failureDetail: 'internal note',
    attempts: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  }) as PromptPublication;

describe('PromptPublicationController', () => {
  let controller: PromptPublicationController;
  let create: jest.Mock;
  let submit: jest.Mock;
  let review: jest.Mock;
  let findForActor: jest.Mock;
  let isOperator: jest.Mock;

  beforeEach(async () => {
    create = jest.fn().mockResolvedValue(row());
    submit = jest
      .fn()
      .mockResolvedValue(row({ state: PromptPublicationState.PENDING_REVIEW }));
    review = jest
      .fn()
      .mockResolvedValue(row({ state: PromptPublicationState.PUBLISHING }));
    findForActor = jest.fn().mockResolvedValue(row());
    isOperator = jest.fn().mockReturnValue(false);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromptPublicationController],
      providers: [
        {
          provide: PromptPublicationService,
          useValue: { create, submit, review, findForActor },
        },
        { provide: OperatorRegistry, useValue: { isOperator } },
      ],
    }).compile();

    controller = module.get(PromptPublicationController);
  });

  afterEach(() => jest.clearAllMocks());

  it('passes the caller public key and price through to the service', async () => {
    await controller.create(ASSET_ID, { priceAtomic: '500' }, user);
    expect(create).toHaveBeenCalledWith(ASSET_ID, 'GCREATOR', '500');
  });

  it('submits on behalf of the caller', async () => {
    const result = await controller.submit(ASSET_ID, user);
    expect(submit).toHaveBeenCalledWith(ASSET_ID, 'GCREATOR');
    expect(result.state).toBe(PromptPublicationState.PENDING_REVIEW);
  });

  it('forwards the review decision and reason', async () => {
    await controller.review(ASSET_ID, { approve: false, reason: 'why' }, user);
    expect(review).toHaveBeenCalledWith(ASSET_ID, 'GCREATOR', false, 'why');
  });

  it('tells the service whether the caller is an operator', async () => {
    isOperator.mockReturnValue(true);
    await controller.findOne(ASSET_ID, user);
    expect(findForActor).toHaveBeenCalledWith(ASSET_ID, 'GCREATOR', true);
  });

  it('never returns reviewer free text or prompt content in the response', async () => {
    const response = await controller.findOne(ASSET_ID, user);
    expect(response).not.toHaveProperty('failureDetail');
    expect(Object.keys(response)).toEqual(
      expect.not.arrayContaining(['content', 'encryptedContent', 'salt']),
    );
  });
});
