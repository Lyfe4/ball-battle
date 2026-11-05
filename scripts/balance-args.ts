// Command-line arguments for `pnpm balance`. Pure, so it can be tested without running matches.
import { parseArgs } from 'node:util';

export const DEFAULT_SEEDS = 500;
export const USAGE = 'Usage: pnpm balance [seeds] [--ball <id>] [--serial] [--ci]';

export interface BalanceOptions {
  /** Seeds per slot order: seeds 0..seeds-1. */
  readonly seeds: number;
  /** Only this ball's matchups and its mirror, for adding or tuning one ball. */
  readonly ballId: string | undefined;
  /** Run every matchup on the main thread instead of across worker threads. */
  readonly serial: boolean;
  /**
   * The reduced check CI runs: no sensitivity runs, and a counter-map allowance scaled to the
   * sample (`ciAllowance`), so only a clear miss fails.
   */
  readonly ci: boolean;
}

/** Parses the arguments after the script name, or returns an error message. */
export function parseBalanceArgs(
  args: readonly string[],
  ballIds: readonly string[],
): BalanceOptions | { readonly error: string } {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...args],
      allowPositionals: true,
      options: {
        ball: { type: 'string' },
        serial: { type: 'boolean', default: false },
        ci: { type: 'boolean', default: false },
      },
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  const { positionals, values } = parsed;
  if (positionals.length > 1)
    return { error: `Expected at most one seed count, got ${positionals.join(' ')}.` };

  let seeds = DEFAULT_SEEDS;
  const [raw] = positionals;
  if (raw !== undefined) {
    seeds = Number(raw);
    if (!Number.isInteger(seeds) || seeds < 1) {
      return { error: `Seed count must be a positive integer, got "${raw}".` };
    }
  }

  const ballId = values.ball;
  if (ballId !== undefined && !ballIds.includes(ballId)) {
    return { error: `Unknown ball "${ballId}". Known balls: ${ballIds.join(', ')}.` };
  }
  return { seeds, ballId, serial: values.serial, ci: values.ci };
}
