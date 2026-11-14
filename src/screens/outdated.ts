// A replay link made under another ruleset (ADR 0022), wired to the page: the notice, playing the
// link under this page's rules (its URL rewritten, so the route opens the match or series), and
// reloading for a link from a newer version. main.ts hands over how to move.
import type { Navigation } from '../app/navigation.ts';
import { writeTodaysRuleset } from '../app/route.ts';
import type { RouteOf } from '../app/router.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { createOutdatedScreen } from '../ui/outdated.ts';

export interface OutdatedHost {
  readonly navigation: Navigation;
  /** Shows whatever screen the URL now names. */
  showCurrentRoute(): void;
  /** Back when the visitor arrived from the link: home, in place of it. */
  goHome(how: 'replace'): void;
}

export interface OutdatedController {
  setVisible(visible: boolean): void;
  show(route: RouteOf<'outdated'>): void;
}

export function createOutdatedController(
  root: HTMLElement,
  host: OutdatedHost,
): OutdatedController {
  const { navigation } = host;
  const screen = createOutdatedScreen(root, {
    onBack: () => {
      navigation.back(() => {
        host.goHome('replace');
      });
    },
    // In place of the old link: the same balls and seed (and picks), under this page's rules.
    // A series the rules now refuse opens its lineup step, prefilled (verifySeries, ADR 0022).
    onPlay: () => {
      navigation.replace(writeTodaysRuleset);
      host.showCurrentRoute();
    },
    onReload: () => {
      window.location.reload();
    },
  });

  return {
    setVisible: (visible) => {
      screen.setVisible(visible);
    },
    show(route) {
      screen.show({ kind: route.kind, newer: route.made > RULESET_VERSION });
    },
  };
}
