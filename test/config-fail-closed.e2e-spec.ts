import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import {
  resetValidatedEnvCache,
  validateEnv,
} from '../src/config/env.validation';

/**
 * Integration coverage for acceptance criterion 3 of issue #16.
 *
 * `src/config/env.validation.spec.ts` calls `validateEnv` directly. That proves
 * the rule but not the wiring: it would still pass if `validate: validateEnv`
 * were dropped from `ConfigModule.forRoot`. These tests drive the same code
 * path the application boots through — ConfigModule invoking the validator —
 * so removing the wiring fails the suite.
 *
 * @nestjs/config passes the validator the merge of the parsed env file and
 * `process.env`, with `process.env` winning, so setting a real environment
 * variable here exercises exactly what a deployment would hit.
 */
describe('Environment fail-closed boot (e2e)', () => {
  const KEYS = [
    'NODE_ENV',
    'JWT_SECRET',
    'PAYMENT_SIMULATION_ENABLED',
    'MOCK_PAYMENT_ENABLED',
    'MOCK_PAYMENT_FAIL',
    'DB_SEED_ON_STARTUP',
  ] as const;

  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    KEYS.forEach((key) => saved.set(key, process.env[key]));
    KEYS.forEach((key) => delete process.env[key]);
    resetValidatedEnvCache();
  });

  afterEach(() => {
    saved.forEach((value, key) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
    resetValidatedEnvCache();
  });

  const boot = () =>
    Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: validateEnv,
        }),
      ],
    }).compile();

  it('boots in test mode', async () => {
    process.env.NODE_ENV = 'test';

    const moduleRef = await boot();
    await moduleRef.close();
  });

  it.each([
    'PAYMENT_SIMULATION_ENABLED',
    'MOCK_PAYMENT_ENABLED',
    'MOCK_PAYMENT_FAIL',
    'DB_SEED_ON_STARTUP',
  ])(
    'refuses to build the config module in staging with %s enabled',
    async (flag) => {
      process.env.NODE_ENV = 'staging';
      process.env.JWT_SECRET = 'a-real-secret';
      process.env[flag] = 'true';

      await expect(boot()).rejects.toThrow(
        `${flag} must be disabled when NODE_ENV is "staging"`,
      );
    },
  );

  it('refuses to build the config module in staging without a JWT secret', async () => {
    process.env.NODE_ENV = 'staging';

    await expect(boot()).rejects.toThrow(
      'JWT_SECRET is required when NODE_ENV is "staging"',
    );
  });

  it('refuses to build the config module when NODE_ENV is unset', async () => {
    // The default for `node dist/main` with no orchestration.
    await expect(boot()).rejects.toThrow(
      'JWT_SECRET is required when NODE_ENV is "unset"',
    );
  });

  it('boots a hardened environment once the signing key is supplied', async () => {
    process.env.NODE_ENV = 'staging';
    process.env.JWT_SECRET = 'a-real-secret';

    const moduleRef = await boot();
    await moduleRef.close();
  });
});
