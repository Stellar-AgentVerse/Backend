import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { OperatorRegistry } from '../operator.registry';
import type { JwtPayload } from '../common/interfaces/jwt-payload.interface';

/**
 * Restricts a route to curated-market operators. Runs after `JwtAuthGuard`,
 * which is what populates `request.user`.
 *
 * The rejection message never names the allowlist or its size — an operator set
 * is an authorization detail, not something an unauthenticated caller should be
 * able to probe.
 */
@Injectable()
export class OperatorGuard implements CanActivate {
  constructor(private readonly operators: OperatorRegistry) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();

    if (!this.operators.isOperator(request.user?.publicKey)) {
      throw new ForbiddenException('Operator privileges required');
    }
    return true;
  }
}
