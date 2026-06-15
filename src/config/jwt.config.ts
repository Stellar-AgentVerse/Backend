import { registerAs } from '@nestjs/config';
import { getValidatedEnv } from './env.validation';

export const jwtConfig = registerAs('jwt', () => ({
  ...getValidatedEnv().jwt,
}));
