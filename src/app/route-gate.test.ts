import { describe, expect, it } from 'vitest';
import type { Screen } from './route.ts';
import { afterReady, gateRoutes } from './route-gate.ts';

interface FakeRoute {
  readonly screen: Screen;
}

/** A gate over `waitsFor`'s screens, which show once `arrive` has run. */
function gate(waitsFor: readonly Screen[], url: FakeRoute = { screen: 'home' }) {
  const shown: Screen[] = [];
  let resolveCode = (): void => undefined;
  const code = new Promise<void>((resolve) => {
    resolveCode = resolve;
  });
  let arrived = false;
  void code.then(() => {
    arrived = true;
  });
  const show = gateRoutes(
    () => url,
    (screen) => (arrived || !waitsFor.includes(screen) ? undefined : code),
    (route) => {
      shown.push(route.screen);
    },
  );
  const arrive = async (): Promise<void> => {
    resolveCode();
    await code;
  };
  return { show, shown, arrive };
}

describe('screens whose code is still coming', () => {
  it('shows a screen that needs nothing at once, in the same task', () => {
    const { show, shown } = gate(['friends']);
    show({ screen: 'manual' });
    show();
    expect(shown).toStrictEqual(['manual', 'home']);
  });

  it('shows a waiting screen once its code has come, and later ones at once', async () => {
    const { show, shown, arrive } = gate(['friends']);
    show({ screen: 'friends' });
    expect(shown).toStrictEqual([]);
    await arrive();
    expect(shown).toStrictEqual(['friends']);
    show({ screen: 'friends' });
    expect(shown).toStrictEqual(['friends', 'friends']);
  });

  it('shows only the last move asked for: a Back meanwhile wins', async () => {
    const { show, shown, arrive } = gate(['friends', 'signin']);
    show({ screen: 'friends' });
    show({ screen: 'home' });
    expect(shown).toStrictEqual(['home']);
    show({ screen: 'signin' });
    show({ screen: 'friends' });
    await arrive();
    expect(shown).toStrictEqual(['home', 'friends']);
  });

  it('runs what follows the first screen after it, never before', async () => {
    const order: string[] = [];
    afterReady(undefined, () => order.push('now'));
    let arrive = (): void => undefined;
    const code = new Promise<void>((resolve) => {
      arrive = resolve;
    });
    afterReady(code, () => order.push('later'));
    expect(order).toStrictEqual(['now']);
    arrive();
    await code;
    expect(order).toStrictEqual(['now', 'later']);
  });
});
