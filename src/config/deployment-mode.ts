/**
 * Single source of truth for "is this a real deployment?".
 *
 * Every other environment gate in this repository compared `NODE_ENV` against
 * the literal `'production'`. That is a denylist of exactly one string, so
 * `NODE_ENV=staging` — or `prod`, or `Production`, or a typo, or unset —
 * silently received development behaviour: the `dev-secret` JWT fallback,
 * database seeding, and the simulated payment adapters.
 *
 * This is an allowlist instead. Only environments that are explicitly known to
 * be non-deployments relax; everything else, including anything unrecognised,
 * is treated as a real deployment and fails closed.
 */

/** The only environments in which simulated money and dev fallbacks are allowed. */
export const SIMULATION_ALLOWED_ENVIRONMENTS = ['development', 'test'] as const;

export type SimulationAllowedEnvironment =
  (typeof SIMULATION_ALLOWED_ENVIRONMENTS)[number];

function readNodeEnv(env: NodeJS.ProcessEnv): string {
  return (env.NODE_ENV ?? '').trim();
}

/**
 * True only for `NODE_ENV=development` and `NODE_ENV=test`.
 *
 * Deliberately exact and case-sensitive: `Development` and `DEV` are not
 * recognised, because guessing at an operator's intent is how a staging box
 * ends up serving simulated balances.
 */
export function isSimulationAllowed(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (SIMULATION_ALLOWED_ENVIRONMENTS as readonly string[]).includes(
    readNodeEnv(env),
  );
}

/** Human-readable environment name for error messages and startup logs. */
export function describeEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const nodeEnv = readNodeEnv(env);
  return nodeEnv === '' ? 'unset' : nodeEnv;
}
