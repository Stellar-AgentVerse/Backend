import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as StellarSdk from '@stellar/stellar-sdk';
import { sorobanConfig } from '../tokens/config/soroban.config';

export type DependencyStatus = 'ok' | 'error' | 'skipped';

export interface DependencyCheck {
  name: string;
  status: DependencyStatus;
  required: boolean;
  latencyMs?: number;
  detail?: string;
}

export interface HealthReport {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  /** Retained for backward compatibility with the previous response shape. */
  db: 'connected' | 'error';
  checks: DependencyCheck[];
}

interface SorobanRpcResult {
  status?: string;
  entries?: unknown[];
}

interface SorobanRpcResponse {
  result?: SorobanRpcResult;
  error?: { message?: string };
}

/** Soroban RPC is polled at most once per window; health probes run often. */
const RPC_CACHE_TTL_MS = 15_000;
const RPC_TIMEOUT_MS = 2_000;
/**
 * A partitioned database accepts the TCP connect and then never answers, so an
 * unbounded query would hang the probe instead of reporting 503 — the one thing
 * a readiness endpoint must not do.
 */
const DB_TIMEOUT_MS = 3_000;

type SorobanSettings = {
  rpcUrl: string;
  contracts: { purchaseContractId: string };
};

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private rpcCache?: { expiresAt: number; check: DependencyCheck };
  private marketplaceContractCache?: {
    expiresAt: number;
    check: DependencyCheck;
  };

  constructor(
    private readonly dataSource: DataSource,
    @Inject(sorobanConfig.KEY) private readonly soroban: SorobanSettings,
  ) {}

  /**
   * Verifies the dependencies a request actually needs, not just that the
   * process is up. A required dependency in `error` makes the whole report
   * `error`, which the controller surfaces as HTTP 503.
   */
  async check(): Promise<HealthReport> {
    // Concurrent: one slow dependency must not add its latency to the others.
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkSchema(),
      this.checkSorobanRpc(),
      this.checkMarketplaceContract(),
      Promise.resolve(this.checkDeliveryWorker()),
    ]);

    const degraded = checks.some(
      (check) => check.required && check.status === 'error',
    );
    const database = checks.find((check) => check.name === 'database');

    return {
      status: degraded ? 'error' : 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      db: database?.status === 'ok' ? 'connected' : 'error',
      checks,
    };
  }

  /** Auto-synchronize builds the schema itself and never creates a migrations table. */
  private get schemaIsMigrationOwned(): boolean {
    return this.dataSource.options?.synchronize !== true;
  }

  private async withDeadline<T>(work: Promise<T>, label: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(`${label} did not answer within ${DB_TIMEOUT_MS}ms`),
              ),
            DB_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async checkDatabase(): Promise<DependencyCheck> {
    const startedAt = Date.now();
    try {
      await this.withDeadline(this.dataSource.query('SELECT 1'), 'database');
      return {
        name: 'database',
        status: 'ok',
        required: true,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'error',
        required: true,
        latencyMs: Date.now() - startedAt,
        detail: (error as Error).message,
      };
    }
  }

  /**
   * A deploy that starts with `DB_SYNCHRONIZE=false` and no migrations applied
   * connects successfully and then fails every query against a missing table.
   * Reporting the applied migration also tells an operator which schema
   * version is live, which the release runbook records.
   */
  private async checkSchema(): Promise<DependencyCheck> {
    if (!this.schemaIsMigrationOwned) {
      return {
        name: 'schema',
        status: 'skipped',
        required: false,
        detail:
          'DB_SYNCHRONIZE is enabled; the schema is owned by auto-synchronize',
      };
    }

    try {
      const rows = await this.withDeadline(
        this.dataSource.query<{ name: string }[]>(
          'SELECT name FROM migrations ORDER BY timestamp DESC LIMIT 1',
        ),
        'schema',
      );
      const latest = rows?.[0]?.name;

      if (!latest) {
        return {
          name: 'schema',
          status: 'error',
          required: true,
          detail: 'no migrations have been applied',
        };
      }

      return {
        name: 'schema',
        status: 'ok',
        required: true,
        detail: latest,
      };
    } catch (error) {
      return {
        name: 'schema',
        status: 'error',
        required: true,
        detail: (error as Error).message,
      };
    }
  }

  /**
   * TokensService.validateConfig() and PurchasesService's mock gate both treat a
   * contract id containing 'PLACEHOLDER' as absent; health reports it the same
   * way so a half-configured environment is not shown as ready.
   */
  private hasMarketplaceContract(): boolean {
    const contractId = this.soroban.contracts.purchaseContractId;
    return Boolean(contractId) && !contractId.includes('PLACEHOLDER');
  }

  /**
   * Required only once a marketplace contract is configured: without RPC the
   * deployment cannot build or verify a purchase, but a Backend running with
   * no contract has nothing to reach RPC for.
   */
  private async checkSorobanRpc(): Promise<DependencyCheck> {
    const required = this.hasMarketplaceContract();

    if (this.rpcCache && this.rpcCache.expiresAt > Date.now()) {
      return { ...this.rpcCache.check, required };
    }

    const startedAt = Date.now();

    let check: DependencyCheck;
    try {
      const result = await this.callSorobanRpc('getHealth');
      if (result.status !== 'healthy') {
        throw new Error(
          `rpc health status: ${result.status ?? 'unknown'}`,
        );
      }

      check = {
        name: 'sorobanRpc',
        status: 'ok',
        required,
        latencyMs: Date.now() - startedAt,
        detail: 'healthy',
      };
    } catch (error) {
      check = {
        name: 'sorobanRpc',
        status: 'error',
        required,
        latencyMs: Date.now() - startedAt,
        detail: (error as Error).message,
      };
    }

    this.rpcCache = { expiresAt: Date.now() + RPC_CACHE_TTL_MS, check };
    return check;
  }

  private async checkMarketplaceContract(): Promise<DependencyCheck> {
    if (!this.hasMarketplaceContract()) {
      return {
        name: 'marketplaceContract',
        status: 'skipped',
        required: false,
        detail: 'SOROBAN_MARKETPLACE_CONTRACT_ID is not configured',
      };
    }

    if (
      this.marketplaceContractCache &&
      this.marketplaceContractCache.expiresAt > Date.now()
    ) {
      return this.marketplaceContractCache.check;
    }

    const startedAt = Date.now();
    const contractId = this.soroban.contracts.purchaseContractId;
    let check: DependencyCheck;

    try {
      // Every deployed Soroban contract has a persistent contract-instance
      // ledger entry. Reading its footprint verifies the configured ID rather
      // than merely echoing an environment variable back as "healthy".
      const contractKey = new StellarSdk.Contract(contractId).getFootprint();
      const result = await this.callSorobanRpc('getLedgerEntries', {
        keys: [contractKey.toXDR('base64')],
      });

      if (!Array.isArray(result.entries) || result.entries.length === 0) {
        throw new Error('marketplace contract was not found on the network');
      }

      check = {
        name: 'marketplaceContract',
        status: 'ok',
        required: true,
        latencyMs: Date.now() - startedAt,
        detail: contractId,
      };
    } catch (error) {
      check = {
        name: 'marketplaceContract',
        status: 'error',
        required: true,
        latencyMs: Date.now() - startedAt,
        detail: (error as Error).message,
      };
    }

    this.marketplaceContractCache = {
      expiresAt: Date.now() + RPC_CACHE_TTL_MS,
      check,
    };
    return check;
  }

  private async callSorobanRpc(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<SorobanRpcResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

    try {
      const response = await fetch(this.soroban.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method,
          ...(params ? { params } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`rpc responded ${response.status}`);
      }

      const payload = (await response.json()) as SorobanRpcResponse;
      if (payload.error) {
        throw new Error(payload.error.message ?? `rpc ${method} failed`);
      }
      if (!payload.result) {
        throw new Error(`rpc ${method} returned no result`);
      }

      return payload.result;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * The worker gate is read verbatim from the environment by
   * PromptDeliveryWorker; reporting it here makes a staging deployment that
   * silently stalls at AUTHORIZED visible from the health endpoint.
   */
  private checkDeliveryWorker(): DependencyCheck {
    const enabled = process.env.PROMPT_DELIVERY_WORKER_ENABLED === 'true';
    const kmsKeyConfigured = Boolean(process.env.AWS_KMS_KEY_ID?.trim());

    if (enabled && !kmsKeyConfigured) {
      return {
        name: 'deliveryWorker',
        status: 'error',
        required: true,
        detail: 'AWS_KMS_KEY_ID is required when the delivery worker is enabled',
      };
    }

    return {
      name: 'deliveryWorker',
      status: enabled ? 'ok' : 'skipped',
      required: enabled,
      detail: enabled
        ? 'polling enabled with KMS encryption'
        : 'PROMPT_DELIVERY_WORKER_ENABLED is not "true"',
    };
  }
}
