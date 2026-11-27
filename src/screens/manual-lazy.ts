// The Balls tab's manual, split from the page's first script (2026-11-28 audit, ADR 0087's
// budget): its entry and matchup chart load as a chunk of their own. The chunk is asked for as the
// page starts, not on the first tap, so it is there by the time anyone opens Balls, and a page that
// goes offline afterwards still opens it (there is no service worker to fetch it later). Until it
// arrives the screen shows its own header at once, in its final place (ADR 0087: static content
// first), and the last show() asked for is drawn when it lands. A chunk that fails to load (the
// network dropped before it came) is asked for again on the next show.
import { BALLS_TITLE } from '../ui/manual/manual-title.ts';
import { createScreenHeader } from '../ui/screen-header.ts';
import type { BallDefinition } from '../sim/types.ts';
import type { Manual } from '../ui/manual/manual.ts';
import type { ManualHost } from './ball-link.ts';

export { createBallLink } from './ball-link.ts';

export function createLazyManual(
  root: HTMLElement,
  balls: readonly BallDefinition[],
  host: ManualHost,
): Manual {
  let real: Manual | undefined;
  let visible = false;
  let asked: { ball: string | undefined; chart: boolean } | undefined;
  let loading: Promise<void> | undefined;

  // The header the manual draws, in its place before the manual's script has come.
  root.classList.add('manual');
  const header = createScreenHeader(
    BALLS_TITLE,
    'Back',
    () => {
      host.back();
    },
    { legend: true, tab: 'balls' },
  );
  root.replaceChildren(header.element);

  function load(): void {
    loading ??= import('./manual.ts')
      .then(({ createManualScreen }) => {
        real = createManualScreen(root, balls, host);
        real.setVisible(visible);
        if (asked !== undefined && visible) real.show(asked.ball, asked.chart);
      })
      .catch(() => {
        // Not loaded (offline as the page started): the next show asks again.
        loading = undefined;
      });
  }
  load();

  return {
    setVisible(next) {
      visible = next;
      if (real === undefined) root.hidden = !next;
      else real.setVisible(next);
    },
    show(ball, chart) {
      if (real !== undefined) {
        real.show(ball, chart);
        return;
      }
      asked = { ball, chart };
      header.focus();
      load();
    },
  };
}
