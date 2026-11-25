// Which motion a screen change makes (ADR 0087, the plan's PR 19), pure. Platform screens stay calm:
// a screen opened from a tab (browsed to: a ball's page, Profile) rises 8 px and fades in over
// --motion-base; going back from it to a tab fades over --motion-quick; a tab change, and anything
// into or out of a task or a fight, doesn't move (the arena's own intro does the work, ADR 0007).
// The rail and the header row never move (screen-motion.css).
import type { ScreenKey } from './history-rules.ts';
import { shellOf } from './tabs.ts';

export type ScreenMotion = 'rise' | 'back' | 'none';

export function screenMotionOf(from: ScreenKey | undefined, to: ScreenKey): ScreenMotion {
  if (from === undefined || from === to) return 'none';
  const was = shellOf(from);
  const now = shellOf(to);
  if (now === 'browse' && (was === 'tab' || was === 'browse')) return 'rise';
  return was === 'browse' && now === 'tab' ? 'back' : 'none';
}
