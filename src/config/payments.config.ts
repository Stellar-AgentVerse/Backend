import { registerAs } from '@nestjs/config';
import { getValidatedEnv } from './env.validation';

export const paymentsConfig = registerAs('payments', () => ({
  ...getValidatedEnv().payments,
}));
