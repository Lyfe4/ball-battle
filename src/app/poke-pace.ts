// How an online screen paces its reads on the poke (ADR 0082, PR 6): the sender's lobby, a start's
// lineup, a live match's end screen and the rematch watch. Each wants the page's socket while it
// shows (guests too: decision 6) and keeps its own read and timer; this says how long to wait.
//
// - **Down** (no socket, or not to be trusted): today's cadence, exactly.
// - **Up**: a `match` poke reads at once; otherwise the next read is the screen's safety read, or
//   just after the next deadline the screen knows (a pick or a lineup running out, a rematch offer
//   expiring), whichever comes first. Nothing the clock decides is poked: the page reads at it.
// - **Every change of state reads at once**: to up, since pokes sent while down are lost; to down,
//   so today's cadence starts from a fresh read rather than a safety wait half run.
import type { PokeHub } from './poke-hub.ts';

/** Read this long after a deadline, for the server to have settled it on that read. */
export const DEADLINE_MARGIN_MS = 500;

export interface PokePace {
  /** Whether pokes can be trusted now. */
  readonly up: boolean;
  /**
   * The wait before the next read: `todayMs` while down; up, `safetyMs` or just after a deadline
   * `untilDeadlineMs` away, whichever is first (a deadline already passed: `todayMs`).
   */
  delay(todayMs: number, untilDeadlineMs?: number | null): number;
  /** Stops listening and lets the socket go. */
  stop(): void;
}

/**
 * Paces a screen's reads on `hub` (none: always today's cadence). `readNow` runs on a `match` poke
 * and on every move to up or down: the screen reads now, or right after a read already out.
 */
export function createPokePace(
  hub: PokeHub | undefined,
  safetyMs: number,
  readNow: () => void,
): PokePace {
  let stopped = false;
  const release = hub?.want();
  const unlisten = hub?.listen({
    onPoke: (event) => {
      if (!stopped && event === 'match') readNow();
    },
    onState: () => {
      if (!stopped) readNow();
    },
  });
  return {
    get up() {
      return !stopped && hub?.up === true;
    },
    delay(todayMs, untilDeadlineMs) {
      if (stopped || hub?.up !== true) return todayMs;
      if (untilDeadlineMs == null) return safetyMs;
      if (untilDeadlineMs < 0) return todayMs;
      return Math.min(safetyMs, untilDeadlineMs + DEADLINE_MARGIN_MS);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      unlisten?.();
      release?.();
    },
  };
}
