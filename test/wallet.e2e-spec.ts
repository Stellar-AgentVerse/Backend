import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { WalletController } from '../src/wallet/wallet.controller';
import { WalletService } from '../src/wallet/wallet.service';
import {
  Wallet,
  CreditPackage,
  WalletTransaction,
  TransactionType,
} from '../src/database/entities';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import {
  CREDIT_PURCHASE_CAPABILITY,
  CREDIT_PURCHASE_NOT_AVAILABLE,
} from '../src/wallet/wallet.capabilities';
import {
  CreditPackagesDto,
  WalletBalanceDto,
  WalletTransactionDto,
} from '../src/wallet/dto/wallet-response.dto';

const CALLER = {
  publicKey: 'GBWALLETOWNER',
  iat: Math.floor(Date.now() / 1000),
};
const VICTIM = 'GBSOMEONEELSE';

/** Successful responses are wrapped by ResponseInterceptor; errors are not. */
type Envelope<T> = { data: T };
type ErrorBody = { statusCode: number; message: string; error: string };

/** First argument of a mock's first call, typed so assertions stay checked. */
function firstArg<T>(mock: jest.Mock): T {
  return (mock.mock.calls[0] as T[])[0];
}

/**
 * Integration coverage for issue #16.
 *
 * The JwtStrategy is the real one, so a 401 here comes from the same passport
 * path the deployed app uses, and the global filter and interceptor are
 * installed so the asserted bodies are the ones a client actually receives.
 *
 * WalletService is also the real one, wired to mocked TypeORM repositories.
 * That matters: mocking the service would make the criterion 4 and 5
 * assertions circular — they would only prove the fixture, not the fix. Here
 * the wallet rows fed in still carry the fabricated values the old code
 * produced, and the assertions check what comes out the other end.
 */
describe('Wallet API (e2e)', () => {
  let app: INestApplication<App>;
  let validToken: string;
  let walletRepo: { findOne: jest.Mock };
  let pkgRepo: { find: jest.Mock };
  let txRepo: { find: jest.Mock };

  beforeAll(async () => {
    walletRepo = { findOne: jest.fn() };
    pkgRepo = { find: jest.fn() };
    txRepo = { find: jest.fn() };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({ jwt: { secret: 'test-secret-for-e2e', expiresIn: '1h' } }),
          ],
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: 'test-secret-for-e2e',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [WalletController],
      providers: [
        JwtStrategy,
        WalletService,
        { provide: getRepositoryToken(Wallet), useValue: walletRepo },
        { provide: getRepositoryToken(CreditPackage), useValue: pkgRepo },
        { provide: getRepositoryToken(WalletTransaction), useValue: txRepo },
      ],
    }).compile();

    app = moduleFixture.createNestApplication<INestApplication<App>>();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());

    await app.init();
    validToken = app.get(JwtService).sign(CALLER);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // A wallet row exactly as the old simulated code would have left it.
    walletRepo.findOne.mockResolvedValue({
      id: 'wallet-1',
      userPublicKey: CALLER.publicKey,
      credits: '450',
      xlmBalance: '1240.45',
      monthlyUsage: '67',
      monthlyAllocation: '100',
    });
    pkgRepo.find.mockResolvedValue([
      {
        id: 'pkg-1',
        name: 'Starter',
        slug: 'starter',
        description: 'Starter pack',
        icon: 'bolt',
        credits: 500,
        price: '50.00',
        originalPrice: null,
        features: null,
        popular: false,
      },
    ]);
    txRepo.find.mockResolvedValue([]);
  });

  describe('unauthenticated requests are rejected (criterion 2)', () => {
    const privateRoutes: Array<[string, () => request.Test]> = [
      [
        'GET /api/wallet/balance',
        () => request(app.getHttpServer()).get('/api/wallet/balance'),
      ],
      [
        'GET /api/wallet/transactions',
        () => request(app.getHttpServer()).get('/api/wallet/transactions'),
      ],
      [
        'POST /api/wallet/purchase',
        () =>
          request(app.getHttpServer())
            .post('/api/wallet/purchase')
            .send({ packageId: 'pkg-1' }),
      ],
    ];

    it.each(privateRoutes)(
      '%s returns 401 without a token',
      async (_name, call) => {
        await call().expect(401);
      },
    );

    it.each(privateRoutes)(
      '%s returns 401 with a malformed token',
      async (_name, call) => {
        await call()
          .set('Authorization', 'Bearer not-a-real-token')
          .expect(401);
      },
    );

    it.each(privateRoutes)(
      '%s returns 401 with a token signed by the wrong key',
      async (_name, call) => {
        const forged = new JwtService({ secret: 'attacker-secret' }).sign(
          CALLER,
        );

        await call().set('Authorization', `Bearer ${forged}`).expect(401);
      },
    );

    it('touches no repository when unauthenticated', async () => {
      await request(app.getHttpServer()).get('/api/wallet/balance').expect(401);

      expect(walletRepo.findOne).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      const expired = new JwtService({ secret: 'test-secret-for-e2e' }).sign(
        CALLER,
        { expiresIn: '-1h' },
      );

      await request(app.getHttpServer())
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);
    });
  });

  describe('wallet identity comes only from the token (criterion 1)', () => {
    it('ignores a ?user= override on the balance route', async () => {
      await request(app.getHttpServer())
        .get(`/api/wallet/balance?user=${VICTIM}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(firstArg(walletRepo.findOne)).toEqual({
        where: { userPublicKey: CALLER.publicKey },
      });
    });

    it('ignores a ?user= override on the transactions route', async () => {
      await request(app.getHttpServer())
        .get(`/api/wallet/transactions?user=${VICTIM}&limit=5&skip=1`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(firstArg(walletRepo.findOne)).toEqual({
        where: { userPublicKey: CALLER.publicKey },
      });
      expect(firstArg(txRepo.find)).toMatchObject({ take: 5, skip: 1 });
    });

    it('ignores a userPublicKey supplied in the request body', async () => {
      await request(app.getHttpServer())
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ userPublicKey: VICTIM, user: VICTIM })
        .expect(200);

      expect(firstArg(walletRepo.findOne)).toEqual({
        where: { userPublicKey: CALLER.publicKey },
      });
    });

    it('scopes to whichever principal the token carries', async () => {
      const otherToken = new JwtService({ secret: 'test-secret-for-e2e' }).sign(
        {
          publicKey: VICTIM,
          iat: Math.floor(Date.now() / 1000),
        },
      );

      await request(app.getHttpServer())
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(200);

      expect(firstArg(walletRepo.findOne)).toEqual({
        where: { userPublicKey: VICTIM },
      });
    });

    it('does not persist a wallet row on a read', async () => {
      walletRepo.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
      const body = res.body as Envelope<WalletBalanceDto>;

      // The repository fixture exposes findOne only: any attempt to persist
      // would throw rather than silently write on a GET.
      expect(Object.keys(walletRepo)).toEqual(['findOne']);
      expect(body.data.credits).toBe(0);
      // Matches the column default a created row would have carried.
      expect(body.data.monthlyAllocation).toBe(100);
    });
  });

  describe('no fabricated money reaches the client (criterion 4)', () => {
    it('never serialises the persisted xlmBalance or a derived USD figure', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
      const body = res.body as Envelope<WalletBalanceDto>;

      // The repository returned xlmBalance '1240.45' — the seeded figure the
      // old code presented as a real holding, at 1240.45 * 0.112 = 138.93 USD.
      expect(JSON.stringify(body)).not.toContain('1240.45');
      expect(JSON.stringify(body)).not.toContain('138.93');
      expect(body.data.onChain).toEqual({
        status: 'UNAVAILABLE',
        reason: 'STELLAR_BALANCE_NOT_INTEGRATED',
        xlmBalance: null,
        xlmUsdEstimate: null,
        asOf: null,
      });
      expect(body.data).not.toHaveProperty('xlmBalance');
      expect(body.data).not.toHaveProperty('xlmUsdEstimate');
      // First-party credit state is real and is still reported.
      expect(body.data.credits).toBe(450);
    });

    it('reports a fabricated txid as having no verified ledger reference', async () => {
      txRepo.find.mockResolvedValue([
        {
          id: 'tx-1',
          type: TransactionType.REFILL,
          description: 'Resource Refill: Starter Pack',
          txid: 'tx-1700000000000-ab12cd',
          amount: '500',
          currency: 'Credits',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
        {
          id: 'tx-2',
          type: TransactionType.PURCHASE,
          description: 'Marketplace: Data Aggregator V2',
          txid: '0x82f...e31',
          amount: '-120',
          currency: 'Credits',
          createdAt: new Date('2023-10-24T00:00:00.000Z'),
        },
      ]);

      const res = await request(app.getHttpServer())
        .get('/api/wallet/transactions')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
      const body = res.body as Envelope<WalletTransactionDto[]>;

      expect(body.data.map((tx) => tx.ledgerReference)).toEqual([null, null]);
      expect(JSON.stringify(body)).not.toContain('0x82f');
      expect(JSON.stringify(body)).not.toContain('tx-1700000000000');
    });
  });

  describe('paging is bounded and never 500s', () => {
    // An out-of-range page size clamps to the nearest valid one; a value that
    // is not a number at all falls back to the default. An empty `?limit=`
    // coerces to 0 through the ValidationPipe, so it clamps rather than
    // defaulting.
    it.each([
      ['abc', 20],
      ['', 1],
      ['0', 1],
      ['999999', 100],
      ['-4', 1],
    ])('limit=%s yields take=%s', async (limit, take) => {
      await request(app.getHttpServer())
        .get(`/api/wallet/transactions?limit=${limit}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(firstArg(txRepo.find)).toMatchObject({ take, skip: 0 });
    });

    it('does not pass a non-finite skip to the query builder', async () => {
      await request(app.getHttpServer())
        .get('/api/wallet/transactions?skip=Infinity')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(firstArg(txRepo.find)).toMatchObject({ skip: 0 });
    });
  });

  describe('credit purchase capability (criterion 5)', () => {
    it('advertises purchasing as unsupported on the public packages route', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/wallet/packages')
        .expect(200);
      const body = res.body as Envelope<CreditPackagesDto>;

      expect(body.data.purchase.supported).toBe(false);
      expect(body.data.purchase.reason).toBe(CREDIT_PURCHASE_NOT_AVAILABLE);
      expect(body.data.packages[0].purchasable).toBe(false);
      // The catalogue itself is still served, so a pricing page still renders.
      expect(body.data.packages[0].name).toBe('Starter');
    });

    it('returns 501 with the same reason code the packages route advertises', async () => {
      const capability = await request(app.getHttpServer())
        .get('/api/wallet/packages')
        .expect(200);
      const advertised = (capability.body as Envelope<CreditPackagesDto>).data
        .purchase.reason;

      const res = await request(app.getHttpServer())
        .post('/api/wallet/purchase')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ packageId: 'pkg-1' })
        .expect(501);
      const body = res.body as ErrorBody;

      // Guards the "cannot drift apart" claim: both values come from
      // CREDIT_PURCHASE_CAPABILITY, and this fails if either stops doing so.
      expect(body.statusCode).toBe(501);
      expect(body.message).toBe(advertised);
      expect(body.message).toBe(CREDIT_PURCHASE_CAPABILITY.reason);
    });

    it('separates "not supported here" from "not allowed" by status code', async () => {
      await request(app.getHttpServer())
        .post('/api/wallet/purchase')
        .send({ packageId: 'pkg-1' })
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/wallet/purchase')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ packageId: 'pkg-1' })
        .expect(501);
    });

    it('settles nothing for any payload shape', async () => {
      for (const payload of [{}, { packageId: 'pkg-1' }, { packageId: 1 }]) {
        await request(app.getHttpServer())
          .post('/api/wallet/purchase')
          .set('Authorization', `Bearer ${validToken}`)
          .send(payload)
          .expect(501);
      }
    });
  });
});
