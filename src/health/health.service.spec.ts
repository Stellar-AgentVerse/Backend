import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { sorobanConfig } from '../tokens/config/soroban.config';
import { DependencyCheck, HealthService } from './health.service';

const APPLIED_MIGRATION = 'AlignMigratedSchemaWithEntities1700000004000';

function find(checks: DependencyCheck[], name: string): DependencyCheck {
  const check = checks.find((candidate) => candidate.name === name);
  if (!check) throw new Error(`missing check: ${name}`);
  return check;
}

describe('HealthService', () => {
  let service: HealthService;
  let dataSource: { query: jest.Mock; options: { synchronize: boolean } };
  let soroban: { rpcUrl: string; contracts: { purchaseContractId: string } };
  let fetchMock: jest.Mock;

  const originalFetch = global.fetch;
  const originalWorkerFlag = process.env.PROMPT_DELIVERY_WORKER_ENABLED;

  async function build() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: DataSource, useValue: dataSource },
        { provide: sorobanConfig.KEY, useValue: soroban },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  }

  beforeEach(async () => {
    dataSource = {
      options: { synchronize: false },
      query: jest
        .fn()
        .mockImplementation((sql: string) =>
          sql.includes('migrations')
            ? Promise.resolve([{ name: APPLIED_MIGRATION }])
            : Promise.resolve([{ '?column?': 1 }]),
        ),
    };
    soroban = {
      rpcUrl: 'https://soroban-testnet.stellar.org',
      contracts: { purchaseContractId: '' },
    };
    fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;
    delete process.env.PROMPT_DELIVERY_WORKER_ENABLED;

    await build();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalWorkerFlag === undefined) {
      delete process.env.PROMPT_DELIVERY_WORKER_ENABLED;
    } else {
      process.env.PROMPT_DELIVERY_WORKER_ENABLED = originalWorkerFlag;
    }
  });

  it('should report ok when the database and schema are reachable', async () => {
    const report = await service.check();

    expect(report.status).toBe('ok');
    expect(report.db).toBe('connected');
    expect(find(report.checks, 'database').status).toBe('ok');
    expect(find(report.checks, 'schema').detail).toBe(APPLIED_MIGRATION);
  });

  it('should report error when the database is unreachable', async () => {
    dataSource.query.mockRejectedValue(new Error('connection refused'));

    const report = await service.check();

    expect(report.status).toBe('error');
    expect(report.db).toBe('error');
    expect(find(report.checks, 'database').detail).toContain(
      'connection refused',
    );
  });

  it('should report error when no migration has been applied', async () => {
    dataSource.query.mockImplementation((sql: string) =>
      sql.includes('migrations')
        ? Promise.resolve([])
        : Promise.resolve([{ ok: 1 }]),
    );

    const report = await service.check();

    expect(report.status).toBe('error');
    expect(find(report.checks, 'schema').detail).toBe(
      'no migrations have been applied',
    );
  });

  it('should not require a migrations table when auto-synchronize owns the schema', async () => {
    dataSource.options.synchronize = true;
    await build();

    const report = await service.check();

    // The schema is legitimately absent from `migrations` in this mode, so the
    // probe must not hold the deployment permanently unready.
    expect(report.status).toBe('ok');
    expect(find(report.checks, 'schema').status).toBe('skipped');
    expect(find(report.checks, 'schema').required).toBe(false);
  });

  it('should fail the database check rather than hang when a query never settles', async () => {
    jest.useFakeTimers();
    dataSource.query.mockImplementation(() => new Promise(() => {}));

    const pending = service.check();
    await jest.advanceTimersByTimeAsync(4000);
    const report = await pending;
    jest.useRealTimers();

    expect(report.status).toBe('error');
    expect(find(report.checks, 'database').detail).toContain('did not answer');
  });

  it('should treat Soroban RPC as optional while no marketplace contract is configured', async () => {
    fetchMock.mockRejectedValue(new Error('rpc unreachable'));

    const report = await service.check();

    expect(report.status).toBe('ok');
    expect(find(report.checks, 'sorobanRpc').status).toBe('error');
    expect(find(report.checks, 'sorobanRpc').required).toBe(false);
    expect(find(report.checks, 'marketplaceContract').status).toBe('skipped');
  });

  it('should treat Soroban RPC as required once a marketplace contract is configured', async () => {
    soroban.contracts.purchaseContractId =
      'CDEPLOYEDMARKETPLACECONTRACTIDFORUNITTEST';
    await build();
    fetchMock.mockRejectedValue(new Error('rpc unreachable'));

    const report = await service.check();

    expect(report.status).toBe('error');
    expect(find(report.checks, 'sorobanRpc').required).toBe(true);
    expect(find(report.checks, 'marketplaceContract').status).toBe('ok');
  });

  it('should not treat a PLACEHOLDER contract id as a configured contract', async () => {
    soroban.contracts.purchaseContractId = 'PLACEHOLDER';
    await build();
    fetchMock.mockRejectedValue(new Error('rpc unreachable'));

    const report = await service.check();

    expect(report.status).toBe('ok');
    expect(find(report.checks, 'sorobanRpc').required).toBe(false);
    expect(find(report.checks, 'marketplaceContract').status).toBe('skipped');
  });

  it('should surface a disabled delivery worker without failing the probe', async () => {
    const report = await service.check();

    expect(report.status).toBe('ok');
    expect(find(report.checks, 'deliveryWorker').status).toBe('skipped');
  });

  it('should report the delivery worker as enabled only for the exact flag value', async () => {
    process.env.PROMPT_DELIVERY_WORKER_ENABLED = 'TRUE';
    expect(find((await service.check()).checks, 'deliveryWorker').status).toBe(
      'skipped',
    );

    process.env.PROMPT_DELIVERY_WORKER_ENABLED = 'true';
    expect(find((await service.check()).checks, 'deliveryWorker').status).toBe(
      'ok',
    );
  });

  it('should cache the Soroban RPC probe instead of calling it on every request', async () => {
    await service.check();
    await service.check();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
