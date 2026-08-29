import {
  describeEnvironment,
  isSimulationAllowed,
  SIMULATION_ALLOWED_ENVIRONMENTS,
} from './deployment-mode';

describe('deployment mode', () => {
  it('allows simulation only in development and test', () => {
    expect(SIMULATION_ALLOWED_ENVIRONMENTS).toEqual(['development', 'test']);
    expect(isSimulationAllowed({ NODE_ENV: 'development' })).toBe(true);
    expect(isSimulationAllowed({ NODE_ENV: 'test' })).toBe(true);
  });

  it('treats every unrecognised environment as a real deployment', () => {
    // The allowlist exists so that a name the codebase has never heard of —
    // 'staging' being the one the issue names — fails closed instead of
    // silently receiving development behaviour.
    for (const nodeEnv of [
      'production',
      'staging',
      'prod',
      'Production',
      'DEVELOPMENT',
      'developmnet',
      'preview',
      '',
    ]) {
      expect(isSimulationAllowed({ NODE_ENV: nodeEnv })).toBe(false);
    }
  });

  it('treats an unset NODE_ENV as a real deployment', () => {
    expect(isSimulationAllowed({})).toBe(false);
  });

  it('ignores surrounding whitespace rather than failing open', () => {
    expect(isSimulationAllowed({ NODE_ENV: '  development  ' })).toBe(true);
    expect(isSimulationAllowed({ NODE_ENV: '  staging  ' })).toBe(false);
  });

  it('describes the environment for error messages', () => {
    expect(describeEnvironment({ NODE_ENV: 'staging' })).toBe('staging');
    expect(describeEnvironment({})).toBe('unset');
    expect(describeEnvironment({ NODE_ENV: '   ' })).toBe('unset');
  });
});
