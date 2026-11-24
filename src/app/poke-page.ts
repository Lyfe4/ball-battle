// The browser page as the poke socket sees it (ADR 0082, `poke-socket.ts`): `document.hidden` and
// the three lifecycle events it reacts to.
import type { PokePage } from './poke-socket.ts';

export const browserPokePage = (): PokePage => ({
  hidden: () => document.hidden,
  listen(events) {
    document.addEventListener('visibilitychange', events.visibility);
    window.addEventListener('pagehide', events.pageHide);
    window.addEventListener('pageshow', events.pageShow);
    return () => {
      document.removeEventListener('visibilitychange', events.visibility);
      window.removeEventListener('pagehide', events.pageHide);
      window.removeEventListener('pageshow', events.pageShow);
    };
  },
});
