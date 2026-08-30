import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OperatorGuard } from './operator.guard';
import { OperatorRegistry } from '../operator.registry';
import { AppEnv } from '../../config/env.schema';

const OPERATOR = 'GOPERATOR';

const contextFor = (publicKey?: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => (publicKey ? { user: { publicKey } } : {}),
    }),
  }) as unknown as ExecutionContext;

const guardWith = (keys: string[] | undefined) => {
  const config = { get: () => keys } as unknown as ConfigService<AppEnv>;
  return new OperatorGuard(new OperatorRegistry(config));
};

describe('OperatorGuard', () => {
  it('allows a configured operator', () => {
    expect(guardWith([OPERATOR]).canActivate(contextFor(OPERATOR))).toBe(true);
  });

  it('denies a key that is not on the list', () => {
    expect(() =>
      guardWith([OPERATOR]).canActivate(contextFor('GSOMEONEELSE')),
    ).toThrow(ForbiddenException);
  });

  it('denies everyone when the list is empty', () => {
    expect(() => guardWith([]).canActivate(contextFor(OPERATOR))).toThrow(
      ForbiddenException,
    );
  });

  it('denies everyone when the list is unset', () => {
    expect(() =>
      guardWith(undefined).canActivate(contextFor(OPERATOR)),
    ).toThrow(ForbiddenException);
  });

  it('denies an unauthenticated request', () => {
    expect(() => guardWith([OPERATOR]).canActivate(contextFor())).toThrow(
      ForbiddenException,
    );
  });

  it('does not leak the allowlist in the rejection message', () => {
    try {
      guardWith([OPERATOR]).canActivate(contextFor('GSOMEONEELSE'));
      fail('expected the guard to reject');
    } catch (error) {
      expect((error as ForbiddenException).message).not.toContain(OPERATOR);
    }
  });
});
