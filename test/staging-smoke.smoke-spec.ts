/**
 * Staging smoke suite.
 *
 * Runs the market journey against a REAL PostgreSQL whose schema was built by
 * `migration:run`, with `DB_SYNCHRONIZE=false` — the configuration a deployed
 * environment uses, and the one under which auto-sync can no longer paper over
 * schema drift. `npm run test:e2e` deliberately does not pick this file up: the
 * e2e specs mock their data layer and run without a database, this one must not.
 *
 * What this suite proves:
 *   - a migration-provisioned schema can actually serve reads and writes;
 *   - the wallet handshake verifies real Ed25519 signatures;
 *   - authorization, duplicate-confirmation and replay guards reject as designed.
 *
 * What it does NOT prove, and why:
 *   - Chain verification. With no `SOROBAN_MARKETPLACE_CONTRACT_ID` configured,
 *     PurchasesService runs in its documented mock-verification mode
 *     (src/marketplace/purchases.service.ts:44-49). The purchase guards below
 *     are all evaluated BEFORE verifyTransaction() is reached, so they are
 *     exercised for real; the confirmation that precedes them is not. The real
 *     settlement case stays pending until a contract is configured — see
 *     docs/release-runbook.md.
 *   - Delivery of an encrypted result. Nothing enqueues a delivery command on
 *     confirmation yet, so there is no result to retrieve (Backend #9).
 */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Keypair } from '@stellar/stellar-sdk';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/config';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { Asset, AssetStatus, AssetType, User } from '../src/database/entities';
import { Purchase } from '../src/database/entities/purchase.entity';

const EXPECTED_ASSET_TYPES = [
  'AGENT',
  'PROMPT',
  'MODEL',
  'DATASET',
  'TOOL',
  'ORACLE',
];

const APPLIED_MIGRATION = 'AlignMigratedSchemaWithEntities1700000004000';

/** ResponseInterceptor wraps every non-health payload. */
interface Envelope<T> {
  data: T;
  meta: { timestamp: string };
}

interface ErrorBody {
  message: string;
}

interface HealthBody {
  status: string;
  db: string;
  checks: { name: string; status: string; detail?: string }[];
}

interface IntentBody {
  purchaseId: string;
  contractId: string;
  unsignedXdr: string;
}

function bodyOf<T>(response: { body: unknown }): T {
  return response.body as T;
}

/**
 * Drift that changes what the database can store. Identifier-only differences
 * (index, foreign-key and enum type names) are expected: the migrations name
 * them explicitly while TypeORM derives hashed names, and neither affects a
 * deployment running with `synchronize: false`.
 *
 * Known blind spot: because index renames are tolerated, an index the entities
 * declare but no migration creates would also be tolerated, including a UNIQUE
 * one. The explicit uuid-default and enum-value assertions above cover the two
 * drift classes that actually broke a migrated deployment; tightening this to
 * pair every CREATE INDEX with a matching DROP is worth doing when a missing
 * index bites.
 */
const SCHEMA_BREAKING_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'missing table', pattern: /^CREATE TABLE/i },
  { label: 'unexpected table', pattern: /^DROP TABLE/i },
  { label: 'missing column', pattern: /ADD "[^"]+" /i },
  { label: 'unexpected column', pattern: /DROP COLUMN/i },
  {
    label: 'missing uuid default',
    pattern: /SET DEFAULT uuid_generate_v4\(\)/i,
  },
  { label: 'missing enum value', pattern: /ADD VALUE/i },
  {
    label: 'column type mismatch',
    pattern: /ALTER COLUMN "[^"]+" TYPE (?!"public")/i,
  },
];

function requireDatabaseEnv(): void {
  if (!process.env.DB_HOST || !process.env.DB_NAME) {
    throw new Error(
      'staging smoke suite requires DB_HOST and DB_NAME to point at a migrated ' +
        'database; refusing to run against an unconfigured target rather than ' +
        'passing vacuously',
    );
  }
}

describe('Testnet staging smoke', () => {
  let app: INestApplication<App>;
  let http: App;
  let dataSource: DataSource;

  const marketplaceContractId =
    process.env.SOROBAN_MARKETPLACE_CONTRACT_ID?.trim() ?? '';
  const chainVerificationConfigured = marketplaceContractId.length > 0;

  const buyer = Keypair.random();
  const otherBuyer = Keypair.random();
  const createdAssetIds: string[] = [];
  const createdPurchaseIds: string[] = [];
  const authenticatedKeys: string[] = [];

  let buyerToken: string;
  let otherBuyerToken: string;
  let publishedPromptId: string;

  async function authenticate(keypair: Keypair): Promise<string> {
    authenticatedKeys.push(keypair.publicKey());

    const challengeResponse = await request(http)
      .post('/api/auth/challenge')
      .send({ publicKey: keypair.publicKey() })
      .expect(200);

    const { challenge } =
      bodyOf<Envelope<{ challenge: string }>>(challengeResponse).data;
    const signature = keypair
      .sign(Buffer.from(challenge, 'utf-8'))
      .toString('hex');

    const walletResponse = await request(http)
      .post('/api/auth/wallet')
      .send({ publicKey: keypair.publicKey(), signature })
      .expect(200);

    return bodyOf<Envelope<{ token: string }>>(walletResponse).data.token;
  }

  async function createIntent(token: string): Promise<string> {
    const response = await request(http)
      .post('/api/marketplace/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({ assetId: publishedPromptId })
      .expect(201);

    const { purchaseId } = bodyOf<Envelope<IntentBody>>(response).data;
    createdPurchaseIds.push(purchaseId);
    return purchaseId;
  }

  // Not `async`: callers chain supertest's own `.expect()` on the returned Test.
  function confirm(purchaseId: string, token: string, transactionHash: string) {
    return request(http)
      .post(`/api/marketplace/purchases/${purchaseId}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({ transactionHash });
  }

  beforeAll(async () => {
    requireDatabaseEnv();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Same pipeline main.ts installs, so response shapes and error codes match
    // what a deployed environment returns.
    app = moduleFixture.createNestApplication();
    setupApp(app);
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();

    http = app.getHttpServer();
    dataSource = app.get(DataSource);

    buyerToken = await authenticate(buyer);
    otherBuyerToken = await authenticate(otherBuyer);

    // There is no publication endpoint yet (Backend #15 owns the curated
    // publication boundary), so the fixture is promoted directly. Recorded as a
    // gap in docs/release-runbook.md rather than presented as a real publication.
    const assets = dataSource.getRepository(Asset);
    const asset: Asset = await assets.save(
      assets.create({
        name: 'Smoke private prompt',
        slug: `smoke-private-prompt-${Date.now()}`,
        description: 'Fixture for the staging smoke suite',
        type: AssetType.PROMPT,
        status: AssetStatus.PUBLISHED,
        creatorPublicKey: otherBuyer.publicKey(),
        price: '10',
      }),
    );

    publishedPromptId = asset.id;
    createdAssetIds.push(asset.id);
  }, 60_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      if (createdPurchaseIds.length) {
        await dataSource.getRepository(Purchase).delete(createdPurchaseIds);
      }
      if (createdAssetIds.length) {
        await dataSource.getRepository(Asset).delete(createdAssetIds);
      }
      // The wallet handshake upserts a real row per public key. Run against a
      // shared environment this suite must not accumulate throwaway identities.
      if (authenticatedKeys.length) {
        await dataSource.getRepository(User).delete(authenticatedKeys);
      }
    }
    await app?.close();
  });

  describe('deploy shape', () => {
    it('serves a schema built by migrations, not by auto-synchronize', async () => {
      expect(dataSource.options.synchronize).toBe(false);

      const applied = await dataSource.query<{ name: string }[]>(
        'SELECT name FROM migrations ORDER BY timestamp ASC',
      );

      expect(applied.length).toBeGreaterThanOrEqual(5);
      expect(applied.map((row) => row.name)).toContain(APPLIED_MIGRATION);
    });

    it('reports dependency health rather than process liveness', async () => {
      const response = await request(http).get('/api/health').expect(200);
      const report = bodyOf<HealthBody>(response);
      const byName = Object.fromEntries(
        report.checks.map((check) => [check.name, check]),
      );

      expect(report.status).toBe('ok');
      expect(report.db).toBe('connected');
      expect(byName.database.status).toBe('ok');
      expect(byName.schema.status).toBe('ok');
      expect(byName.schema.detail).toBe(APPLIED_MIGRATION);
    });

    it('gives every uuid primary key a database-side default', async () => {
      const missing = await dataSource.query<{ table_name: string }[]>(`
        SELECT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.table_constraints tc
          ON tc.table_name = c.table_name
         AND tc.table_schema = 'public'
         AND tc.constraint_type = 'PRIMARY KEY'
        JOIN information_schema.key_column_usage k
          ON k.constraint_name = tc.constraint_name
         AND k.column_name = c.column_name
        WHERE c.table_schema = 'public'
          AND c.data_type = 'uuid'
          AND c.column_default IS NULL
      `);

      expect(missing.map((row) => row.table_name)).toEqual([]);
    });

    it('accepts every AssetType the application can produce', async () => {
      const values = await dataSource.query<{ enumlabel: string }[]>(`
        SELECT e.enumlabel
        FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'asset_type_enum'
      `);

      expect(values.map((row) => row.enumlabel).sort()).toEqual(
        [...EXPECTED_ASSET_TYPES].sort(),
      );
    });

    it('has no schema drift that would change what the database can store', async () => {
      const { upQueries } = await dataSource.driver.createSchemaBuilder().log();
      const statements = upQueries.map((query) =>
        query.query.replace(/\s+/g, ' ').trim(),
      );

      const breaking = statements.flatMap((statement) =>
        SCHEMA_BREAKING_PATTERNS.filter(({ pattern }) =>
          pattern.test(statement),
        ).map(({ label }) => `${label}: ${statement}`),
      );

      expect(breaking).toEqual([]);
    });
  });

  describe('wallet authentication', () => {
    it('issues a token for a signature the claimed key actually produced', async () => {
      const token = await authenticate(Keypair.random());

      expect(token.split('.')).toHaveLength(3);
    });

    it('rejects a challenge signed by a different key', async () => {
      const claimed = Keypair.random();
      const impostor = Keypair.random();

      const challengeResponse = await request(http)
        .post('/api/auth/challenge')
        .send({ publicKey: claimed.publicKey() })
        .expect(200);

      const { challenge } =
        bodyOf<Envelope<{ challenge: string }>>(challengeResponse).data;
      const signature = impostor
        .sign(Buffer.from(challenge, 'utf-8'))
        .toString('hex');

      await request(http)
        .post('/api/auth/wallet')
        .send({ publicKey: claimed.publicKey(), signature })
        .expect(401);
    });

    it('rejects a replayed challenge', async () => {
      const keypair = Keypair.random();
      // Authenticates once below, so its user row needs cleaning up too.
      authenticatedKeys.push(keypair.publicKey());

      const challengeResponse = await request(http)
        .post('/api/auth/challenge')
        .send({ publicKey: keypair.publicKey() })
        .expect(200);

      const { challenge } =
        bodyOf<Envelope<{ challenge: string }>>(challengeResponse).data;
      const signature = keypair
        .sign(Buffer.from(challenge, 'utf-8'))
        .toString('hex');

      await request(http)
        .post('/api/auth/wallet')
        .send({ publicKey: keypair.publicKey(), signature })
        .expect(200);

      // The challenge is single-use, so the same signature must not work twice.
      await request(http)
        .post('/api/auth/wallet')
        .send({ publicKey: keypair.publicKey(), signature })
        .expect(401);
    });
  });

  describe('write path on a migrated schema', () => {
    it('creates an asset without the application supplying a primary key', async () => {
      const response = await request(http)
        .post('/api/assets')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({
          name: 'Smoke prompt',
          type: AssetType.PROMPT,
          description: 'Fixture created by the staging smoke suite',
          price: 10,
        })
        .expect(201);

      const { id } = bodyOf<Envelope<{ id: string }>>(response).data;
      createdAssetIds.push(id);

      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('rejects an unauthenticated create', async () => {
      await request(http)
        .post('/api/assets')
        .send({ name: 'No token', type: AssetType.PROMPT })
        .expect(401);
    });
  });

  describe('purchase guards', () => {
    it('refuses an unauthenticated purchase intent', async () => {
      await request(http)
        .post('/api/marketplace/purchases')
        .send({ assetId: publishedPromptId })
        .expect(401);
    });

    it('binds the intent to the configured contract and network', async () => {
      const response = await request(http)
        .post('/api/marketplace/purchases')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ assetId: publishedPromptId })
        .expect(201);

      const intent = bodyOf<Envelope<IntentBody>>(response).data;
      createdPurchaseIds.push(intent.purchaseId);

      if (chainVerificationConfigured) {
        // A configured environment must never fall back to the mock builder.
        expect(intent.contractId).toBe(marketplaceContractId);
        expect(intent.unsignedXdr).not.toContain('mock-unsigned-xdr');
      } else {
        expect(intent.contractId).toBe('MOCK_CONTRACT');
      }
    });

    it('rejects a confirmation from a wallet that does not own the purchase', async () => {
      const purchaseId = await createIntent(buyerToken);

      const response = await confirm(
        purchaseId,
        otherBuyerToken,
        'f'.repeat(64),
      );

      expect(response.status).toBe(401);
      expect(bodyOf<ErrorBody>(response).message).toBe(
        'Purchase does not belong to this user',
      );
    });

    it('rejects a second confirmation of the same purchase', async () => {
      const purchaseId = await createIntent(buyerToken);
      const transactionHash = `a${'0'.repeat(63)}`;

      await confirm(purchaseId, buyerToken, transactionHash).expect(200);

      const response = await confirm(purchaseId, buyerToken, transactionHash);

      expect(response.status).toBe(409);
      expect(bodyOf<ErrorBody>(response).message).toBe(
        'Purchase is already verified',
      );
    });

    it('rejects a transaction hash that already settled another purchase', async () => {
      const settledHash = `b${'1'.repeat(63)}`;

      const firstPurchaseId = await createIntent(buyerToken);
      await confirm(firstPurchaseId, buyerToken, settledHash).expect(200);

      const replayPurchaseId = await createIntent(buyerToken);
      const response = await confirm(replayPurchaseId, buyerToken, settledHash);

      expect(response.status).toBe(409);
      expect(bodyOf<ErrorBody>(response).message).toBe(
        'Transaction hash has already been used',
      );
    });

    it('does not leak a settled purchase to another wallet', async () => {
      const purchaseId = await createIntent(buyerToken);
      await confirm(purchaseId, buyerToken, `c${'2'.repeat(63)}`).expect(200);

      await request(http)
        .get(`/api/marketplace/purchases/${purchaseId}/access`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      const response = await request(http)
        .get(`/api/marketplace/purchases/${purchaseId}/access`)
        .set('Authorization', `Bearer ${otherBuyerToken}`);

      expect(response.status).toBe(401);
      expect(bodyOf<ErrorBody>(response).message).toBe(
        'Access denied: not the purchase owner',
      );
    });
  });

  describe('encrypted delivery', () => {
    it('refuses an unauthenticated delivery read', async () => {
      await request(http)
        .get('/api/prompt-delivery/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });

    it('does not disclose whether another wallet has a delivery result', async () => {
      const purchaseId = await createIntent(buyerToken);

      const response = await request(http)
        .get(`/api/prompt-delivery/${purchaseId}`)
        .set('Authorization', `Bearer ${otherBuyerToken}`);

      expect(response.status).toBe(404);
      expect(bodyOf<ErrorBody>(response).message).toBe(
        'Delivery result not found',
      );
    });
  });

  // Blocked, not forgotten. Settling a real Testnet purchase needs a deployed
  // marketplace contract with a registered prompt (Backend #9, #15) and a
  // funded buyer identity; retrieving an encrypted result additionally needs
  // confirmation to enqueue a delivery command, which it does not yet do.
  it.todo(
    'settles a real Testnet purchase and returns an encrypted delivery result',
  );
});
