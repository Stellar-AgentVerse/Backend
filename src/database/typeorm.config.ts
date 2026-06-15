import { registerAs } from '@nestjs/config';
import { getValidatedEnv } from '../config/env.validation';

export const typeormConfig = registerAs('typeorm', () => ({
  ...getValidatedEnv().db,
}));
