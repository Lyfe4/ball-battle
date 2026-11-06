// The arena: the match on screen, its battle-feel effects and the frame loop that advances it
// (ADR 0007). main.ts decides which match to show and which screen is up; this module only plays
// and draws one match at a time.
import { advanceFrame, interpolationAlpha, startPlayback, type Playback } from './app/playback.ts';
import { isClockBusy } from './app/presentation-clock.ts';
import { scaleFrame, type PlaybackSpeed } from './app/speed.ts';
import { fitCanvasToContainer } from './render/canvas.ts';
import { drawWorld } from './render/draw.ts';
import { createEffects } from './render/effects.ts';
import { feelOf, wallBounces } from './render/impact.ts';
import { interpolateWorld } from './render/interpolate.ts';
import { introLook } from './render/motion.ts';
import { theme } from './render/theme.ts';
import { step } from './sim/step.ts';
import type { DefinitionLookup, WorldState } from './sim/types.ts';
import { element } from './ui/dom.ts';
import { createWinnerSticker } from './ui/winner-sticker.ts';

/** What the arena needs from the page around it. */
export interface ArenaHost {
  /** True while something covers the match (a dialog): no time passes, like a hidden tab. */
  isPaused(): boolean;
  readonly speed: () => PlaybackSpeed;
  /** After a frame's ticks: the series records a finished match here. */
  afterTicks(world: WorldState): void;
  /**
   * After every draw, with the sim's latest world, whether the result is showing, and whether the
   * Winner sticker's moment is over: a screen that dims or covers the arena waits for that, so the
   * celebration plays at full brightness (ADR 0033).
   */
  drawn(world: WorldState, resultShown: boolean, celebrated: boolean): void;
}

export interface Arena {
  /** Puts a new match on screen: playback and effects start over. */
  show(world: WorldState): void;
  /** Draws the match on screen again (e.g. after the HUD changed around it). */
  redraw(): void;
  /** The sim's latest world. */
  world(): WorldState;
  /** True once the match's intro has played and both balls are fully drawn. */
  introOver(): boolean;
}

/**
 * Plays `initial` at once and keeps the frame loop running for the life of the page. Each frame
 * advances the fixed-step sim on presentation time, applies the events' effects and draws when
 * anything moved.
 */
export function createArena(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  lookup: DefinitionLookup,
  initial: WorldState,
  host: ArenaHost,
): Arena {
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Canvas 2D is not supported in this browser');
  const ctx = context;
  const effects = createEffects();
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let playback: Playback = startPlayback(initial, theme.introMs);
  let lastFrameMs: number | undefined;
  let canvasView = { canvasPixels: 0, cssPixels: 0 };
  /**
   * Set when a frame threw (the sim throws on purpose for impossible values): the match stops where
   * it was and a message shows, until the next `show`. The loop itself keeps running.
   */
  let failed = false;
  const failure = element(
    'p',
    'arena-error',
    'Something went wrong in this match, so it stopped. Reload the page to try again.',
  );
  failure.setAttribute('role', 'alert');
  failure.hidden = true;
  container.append(failure);
  const sticker = createWinnerSticker(container, lookup);

  function applyReducedMotion(): void {
    effects.setReducedMotion(reducedMotionQuery.matches);
  }
  applyReducedMotion();
  reducedMotionQuery.addEventListener('change', applyReducedMotion);

  /**
   * Draws the world between the last two ticks (so motion is smooth at any refresh rate) with
   * every effect at the current effect time.
   */
  function render(): void {
    const { world, effectMs: now } = playback;
    const reduced = reducedMotionQuery.matches;
    const drawn = interpolateWorld(playback.previous, world, interpolationAlpha(playback));
    drawWorld(ctx, drawn, lookup, canvasView, {
      flash: (ballId) => effects.flash(ballId, now),
      heal: (ballId) => effects.heal(ballId, now),
      healAmount: (ballId) => effects.healAmount(ballId),
      sparks: effects.sparks(now),
      strikes: effects.strikes(now),
      shake: effects.shake(now),
      squash: (ballId) => effects.squash(ballId, now),
      ghost: (ballId, health) => effects.ghost(ballId, health, now),
      particles: effects.particles(now),
      knockouts: effects.knockouts(now),
      winner: effects.winner(now),
      intro: (index) => introLook(index, now, reduced),
      cue: (ballId) => effects.cue(ballId, now),
      reducedMotion: reduced,
    });
    // Due just after a knockout's slow-mo, or at once for a time-limit end.
    sticker.update(world, effects.stickerVisible(now));
    host.drawn(world, effects.resultVisible(now), effects.celebrationOver(now));
  }

  /**
   * One frame. Scheduled before anything can throw, so an error never stops the loop silently: it
   * stops this match with a visible message, and the next match shown plays normally.
   */
  function frame(nowMs: number): void {
    requestAnimationFrame(frame);
    if (failed) return;
    try {
      advance(nowMs);
    } catch (error) {
      failed = true;
      lastFrameMs = undefined;
      failure.hidden = false;
      console.error('The match stopped: a frame threw.', error);
    }
  }

  function advance(nowMs: number): void {
    // The match pauses while a dialog covers it, like a hidden tab: no time passes, so it carries
    // on exactly where it stopped. The loop asks rather than listening for the dialog's close
    // event, which did not fire in a background tab (ADR 0011).
    if (host.isPaused()) {
      lastFrameMs = undefined;
      return;
    }
    if (lastFrameMs !== undefined) {
      const wasBusy = isClockBusy(playback.clock);
      const resultWasShown = effects.resultVisible(playback.effectMs);
      const wasCelebrated = effects.celebrationOver(playback.effectMs);
      const outcome = advanceFrame(
        playback,
        scaleFrame(nowMs - lastFrameMs, host.speed()),
        (world) => step(world, lookup),
        ({ result }) => feelOf(result.events, reducedMotionQuery.matches),
      );
      playback = outcome.playback;
      for (const { previous, result } of outcome.ticks) {
        effects.apply(result.events, playback.effectMs);
        effects.bounced(wallBounces(previous, result.world), playback.effectMs);
      }
      host.afterTicks(playback.world);
      // Draw every frame while the match runs (balls move between ticks), while the intro, a
      // hit-stop or slow-mo runs, after the match ends while effects (the knockout sequence, the
      // final flash) play out, and on the frame the result appears: its delay outlasts every
      // effect, so without this the result (and its buttons) would wait for some unrelated redraw.
      const running = playback.world.match.status === 'running';
      const busy = wasBusy || isClockBusy(playback.clock);
      const resultAppeared =
        effects.resultVisible(playback.effectMs) !== resultWasShown ||
        effects.celebrationOver(playback.effectMs) !== wasCelebrated;
      if (
        running ||
        outcome.ticks.length > 0 ||
        busy ||
        resultAppeared ||
        effects.isActive(playback.effectMs)
      ) {
        render();
      }
    }
    lastFrameMs = nowMs;
  }

  // Browsers pause requestAnimationFrame in hidden tabs. Restart timing on return so the match
  // picks up where it paused instead of counting the time away.
  document.addEventListener('visibilitychange', () => {
    lastFrameMs = undefined;
  });

  fitCanvasToContainer(canvas, container, (size) => {
    canvasView = { canvasPixels: size.pixels, cssPixels: size.cssPixels };
    render();
  });
  requestAnimationFrame(frame);

  return {
    show(world) {
      failed = false;
      failure.hidden = true;
      playback = startPlayback(world, theme.introMs);
      effects.reset();
      lastFrameMs = undefined;
      render();
    },
    redraw: render,
    world: () => playback.world,
    introOver: () => playback.effectMs >= theme.introMs,
  };
}
