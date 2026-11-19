// PROTOTYPE ONLY (proto/ball-looks): `?titan=brow|carved|boulder` picks which of the three Titan
// faces this page draws, so the owner can try each in a real fight. Kept for the tab's session,
// since the game rewrites its URL as it moves between screens. Applied once, when the ball designs
// load (ball-designs/index.ts), before anything is drawn. Goes once a face is chosen.
import { chooseTitanLook, isTitanLook } from '../render/ball-designs/titan.ts';

const KEY = 'ballbattle.proto.titanLook';

/** The little of sessionStorage it needs (this file is also built without the DOM's types). */
interface Session {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function applyTitanLook(search: string, session: () => Session | undefined): void {
  const asked = new URLSearchParams(search).get('titan');
  if (isTitanLook(asked)) chooseTitanLook(asked);
  try {
    if (isTitanLook(asked)) session()?.setItem(KEY, asked);
    else {
      const kept = session()?.getItem(KEY);
      if (isTitanLook(kept)) chooseTitanLook(kept);
    }
  } catch {
    // Storage blocked (a private window): the link's choice still holds for this page.
  }
}

const page = globalThis as { location?: { search: string }; sessionStorage?: Session };
if (page.location !== undefined) applyTitanLook(page.location.search, () => page.sessionStorage);
