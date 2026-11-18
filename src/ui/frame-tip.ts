// Why fights look less smooth (ADR 0063 addendum): when a fight has been drawn at about 30 frames a
// second or fewer for a sustained stretch (Low Power Mode, battery saver, an old phone), one quiet
// line under the match says so once, after the fight, never over the court and never during one.
// The arena hands in each fight frame's gap; the line lives in the HUD (`#frame-tip`).
import { createSlowFrames } from '../app/slow-frames.ts';
import type { Tips } from '../app/tips.ts';
import { setHidden, setText } from './dom.ts';

/** Right on any device (an iPhone, Android, an old phone), and never the player's fault. */
export const FRAME_TIP_TEXT =
  'Fights look less smooth on this device. Try turning off Low Power Mode or battery saver.';

export interface FrameTip {
  /**
   * A new match on screen: whether its frames are judged (a fight watched, not the home demo).
   * Frames are judged across fights: a short fight at 2x is only a few seconds.
   */
  start(watching: boolean): void;
  /** One frame's real gap from the last, in ms, while the fight runs. */
  frame(gapMs: number): void;
  /** After each draw: `over` once the fight has ended and its Winner moment has passed. */
  settle(over: boolean): void;
}

export function createFrameTip(line: HTMLElement, tips: Tips): FrameTip {
  const slow = createSlowFrames();
  let watching = false;
  return {
    start(next) {
      watching = next;
      setHidden(line, true);
    },
    frame(gapMs) {
      if (watching) slow.add(gapMs);
    },
    settle(over) {
      if (!watching || !over || !line.hidden || !slow.sustained()) return;
      if (!tips.takeFrameTip()) return;
      // Written as it shows, so a screen reader hears it once (the line is a polite status).
      setText(line, FRAME_TIP_TEXT);
      setHidden(line, false);
    },
  };
}
