import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { PaymentsController } from '../src/payments/payments.controller';
import { PaymentsService } from '../src/payments/payments.service';
import { StripeAdapter } from '../src/payments/adapters/stripe.adapter';
import { PayPalAdapter } from '../src/payments/adapters/paypal.adapter';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

const CALLER = { publicKey: 'GBPAYER', iat: Math.floor(Date.now() / 1000) };

/** Successful responses are wrapped by ResponseInterceptor. */
type Envelope<T> = { data: T };
type PaymentBody = {
  success: boolean;
  transactionId: string;
  metadata?: Record<string, unknown>;
};
type ProvidersBody = { providers: string[] };

/**
 * The payment adapters have no provider SDK behind them and have only ever
 * fabricated their results. This exercises the two guarantees that keep a
 * fabricated success out of a deployment: the mutating routes require a token,
 * and with simulation disabled no adapter produces a success or an invented id.
 */
describe('Payments API (e2e)', () => {
  let app: INestApplication<App>;
  let validToken: string;

  const buildApp = async (
    simulationEnabled: boolean,
  ): Promise<INestApplication<App>> => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              jwt: { secret: 'test-secret-for-e2e', expiresIn: '1h' },
              payments: { simulationEnabled },
            }),
          ],
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: 'test-secret-for-e2e',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [PaymentsController],
      providers: [JwtStrategy, PaymentsService, StripeAdapter, PayPalAdapter],
    }).compile();

    const created =
      moduleFixture.createNestApplication<INestApplication<App>>();
    created.setGlobalPrefix('api');
    created.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    created.useGlobalFilters(new HttpExceptionFilter());
    created.useGlobalInterceptors(new ResponseInterceptor());
    await created.init();
    return created;
  };

  describe('with payment simulation disabled (every real deployment)', () => {
    beforeAll(async () => {
      process.env.STRIPE_API_KEY = 'sk_live_looks_completely_real';
      process.env.PAYPAL_CLIENT_ID = 'live-client-id';
      process.env.PAYPAL_CLIENT_SECRET = 'live-client-secret';
      app = await buildApp(false);
      validToken = app.get(JwtService).sign(CALLER);
    });

    afterAll(async () => {
      delete process.env.STRIPE_API_KEY;
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      await app.close();
    });

    it('returns 401 for an unauthenticated payment', async () => {
      await request(app.getHttpServer())
        .post('/api/payments')
        .send({ amount: 10, currency: 'USD', provider: 'stripe' })
        .expect(401);
    });

    it('returns 401 for an unauthenticated refund', async () => {
      await request(app.getHttpServer())
        .post('/api/payments/refund')
        .send({ transactionId: 'tx-1', provider: 'stripe' })
        .expect(401);
    });

    it('returns 401 for unauthenticated verification', async () => {
      await request(app.getHttpServer())
        .get('/api/payments/verify/tx-1?provider=stripe')
        .expect(401);
    });

    it('reports no usable providers even with credentials configured', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/payments/providers')
        .expect(200);
      const body = res.body as Envelope<ProvidersBody>;

      expect(body.data.providers).toEqual([]);
    });

    it('refuses to fabricate a successful payment for an authenticated caller', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ amount: 10, currency: 'USD', provider: 'stripe' })
        .expect(201);
      const body = res.body as Envelope<PaymentBody>;

      expect(body.data.success).toBe(false);
      expect(body.data.transactionId).toBe('N/A');
      expect(JSON.stringify(body)).not.toContain('stripe_');
    });

    it('refuses to fabricate a successful refund', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ transactionId: 'tx-1', provider: 'paypal' })
        .expect(201);
      const body = res.body as Envelope<PaymentBody>;

      expect(body.data.success).toBe(false);
      expect(JSON.stringify(body)).not.toContain('paypal_refund_');
    });
  });

  describe('with payment simulation enabled (development and test only)', () => {
    let devApp: INestApplication<App>;

    beforeAll(async () => {
      process.env.STRIPE_API_KEY = 'sk_test_key';
      devApp = await buildApp(true);
    });

    afterAll(async () => {
      delete process.env.STRIPE_API_KEY;
      await devApp.close();
    });

    it('marks every fabricated identifier as simulated', async () => {
      const token = devApp.get(JwtService).sign(CALLER);

      const res = await request(devApp.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 10, currency: 'USD', provider: 'stripe' })
        .expect(201);
      const body = res.body as Envelope<PaymentBody>;

      expect(body.data.success).toBe(true);
      expect(body.data.transactionId).toMatch(/^simulated_stripe_/);
      expect(body.data.metadata?.simulated).toBe(true);
    });
  });
});
