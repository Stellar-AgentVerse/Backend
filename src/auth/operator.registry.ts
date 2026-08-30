import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppEnv } from '../config/env.schema';

/**
 * Curated-market operators, resolved from configuration.
 *
 * The codebase has no role model yet, so the allowlist stands in for one. It is
 * deliberately fail-closed: an unset or empty list authorizes nobody, so a
 * misconfigured deployment cannot silently open the review endpoint.
 */
@Injectable()
export class OperatorRegistry {
  constructor(private readonly configService: ConfigService<AppEnv>) {}

  isOperator(publicKey: string | undefined): boolean {
    if (!publicKey) {
      return false;
    }
    return this.keys().includes(publicKey);
  }

  private keys(): string[] {
    return this.configService.get('operatorPublicKeys', { infer: true }) ?? [];
  }
}
