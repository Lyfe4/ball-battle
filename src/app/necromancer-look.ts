// PROTOTYPE ONLY (proto/ball-looks-2): `?necro=skull|ring` picks which of the two Necromancer
// looks this page draws, so the owner can try each in a real fight. Kept for the tab's session,
// since the game rewrites its URL as it moves between screens. Applied once, when the ball designs
// load (ball-designs/index.ts), before anything is drawn. Goes once a look is chosen.
import { chooseNecromancerLook, isNecromancerLook } from '../render/ball-designs/necromancer.ts';

const KEY = 'ballbattle.proto.necromancerLook';

/** The little of sessionStorage it needs (this file is also built without the DOM's types). */
interface Session {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function applyNecromancerLook(search: string, session: () => Session | undefined): void {
  const asked = new URLSearchParams(search).get('necro');
  if (isNecromancerLook(asked)) chooseNecromancerLook(asked);
  try {
    if (isNecromancerLook(asked)) session()?.setItem(KEY, asked);
    else {
      const kept = session()?.getItem(KEY);
      if (isNecromancerLook(kept)) chooseNecromancerLook(kept);
    }
  } catch {
    // Storage blocked (a private window): the link's choice still holds for this page.
  }
}

const page = globalThis as { location?: { search: string }; sessionStorage?: Session };
if (page.location !== undefined)
  applyNecromancerLook(page.location.search, () => page.sessionStorage);
