import type { StepResult, WorldState } from '../sim/types.ts';
import { advanceClock, TICK_MS } from './fixed-step.ts';
import {
  advancePresentation,
  startClock,
  withHitStop,
  withSlowMo,
  type PresentationClock,
} from './presentation-clock.ts';

/** Everything the frame loop carries from one frame to the next. Plain data. */
export interface Playback {
  readonly world: WorldState;
  /**
   * The world one tick before `world`, for drawing between the two (the renderer interpolates by
   * `interpolationAlpha`). Equal to `world` until the first tick, so a new match never smears.
   */
  readonly previous: WorldState;
  readonly clock: PresentationClock;
  /** Leftover sim time, in ms, not yet worth a whole tick. */
  readonly accumulatorMs: number;
  /** Effect time now, in ms: real time with hit-stops removed and slow-mo scaled. */
  readonly effectMs: number;
}

/** One tick played this frame: the world before it and what `step` returned. */
export interface PlayedTick {
  readonly previous: WorldState;
  readonly result: StepResult;
}

/** What a tick asks of the clock. Decided by the renderer from the tick's events. */
export interface TickFeel {
  readonly hitStopMs: number;
  readonly slowMo?: { readonly ms: number; readonly scale: number };
}

export interface FrameOutcome {
  readonly playback: Playback;
  /** Ticks played this frame, in order. */
  readonly ticks: readonly PlayedTick[];
}

export function startPlayback(world: WorldState, introMs: number): Playback {
  return { world, previous: world, clock: startClock(introMs), accumulatorMs: 0, effectMs: 0 };
}

/**
 * How far between `previous` and `world` to draw, 0 to 1: the share of the next tick already
 * banked in the accumulator. A finished match draws its final world (1), since no tick follows;
 * during a hit-stop the banked time can exceed a tick, which clamps to the tick just played.
 */
export function interpolationAlpha(playback: Playback): number {
  if (playback.world.match.status !== 'running') return 1;
  return Math.min(1, Math.max(0, playback.accumulatorMs / TICK_MS));
}

/**
 * Advances playback by one frame of `realMs` real time. Runs whole ticks through `stepWorld`, in
 * order, as many as the presentation clock allows; a tick that asks for a hit-stop ends the frame
 * there, and the time of the ticks it skipped stays banked for later. So hit-stops and slow-mo
 * change when ticks run, never which ticks run or what they compute (ADR 0007).
 */
export function advanceFrame(
  playback: Playback,
  realMs: number,
  stepWorld: (world: WorldState) => StepResult,
  feelFor: (tick: PlayedTick) => TickFeel,
): FrameOutcome {
  const presentation = advancePresentation(playback.clock, realMs);
  let { clock } = presentation;
  const fixed = advanceClock(playback.accumulatorMs, presentation.simMs);
  let { accumulatorMs } = fixed;
  let { world, previous } = playback;
  const ticks: PlayedTick[] = [];

  for (let i = 0; i < fixed.ticks && world.match.status === 'running'; i++) {
    const result = stepWorld(world);
    const played = { previous: world, result };
    ticks.push(played);
    previous = world;
    world = result.world;

    const feel = feelFor(played);
    if (feel.slowMo !== undefined) clock = withSlowMo(clock, feel.slowMo.ms, feel.slowMo.scale);
    if (feel.hitStopMs > 0) {
      clock = withHitStop(clock, feel.hitStopMs);
      accumulatorMs += (fixed.ticks - i - 1) * TICK_MS;
      break;
    }
  }

  return {
    playback: {
      world,
      previous,
      clock,
      accumulatorMs,
      effectMs: playback.effectMs + presentation.effectMs,
    },
    ticks,
  };
}
