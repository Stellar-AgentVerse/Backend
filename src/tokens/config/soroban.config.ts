import { registerAs } from '@nestjs/config';
import { getValidatedEnv } from '../../config/env.validation';

export const sorobanConfig = registerAs('soroban', () => ({
  ...getValidatedEnv().stellar,
}));
