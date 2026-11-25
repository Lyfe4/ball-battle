// Reduced motion fades or doesn't move (ADR 0087): with the page preferring reduced motion
// (Playwright's media emulation, in every engine), the screen motion, the sheet, the incoming
// banner, its fold into the badge and the badge's pulse run no animation or transition that moves
// anything; with motion welcome, the screen motion and the banner's fold do move (so the check
// can fail).
import { afterEach, describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import '../style.css';
import { challengeIncoming } from '../screens/incoming-text.ts';
import { createIncomingBanner, pulse } from './online/incoming-banner.ts';
import { playScreenMotion } from './screen-motion.ts';
import { createSheet } from './sheet.ts';

declare module 'vitest/browser' {
  interface BrowserCommands {
    reduceMotion: (on: boolean) => Promise<void>;
  }
}

const frame = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 20)));

/** Every running animation or transition that moves something (a transform, translate or scale). */
function moving(): string[] {
  return document.getAnimations().flatMap((animation) => {
    const effect = animation.effect;
    if (!(effect instanceof KeyframeEffect)) return [];
    const moves = effect
      .getKeyframes()
      .some((frame) => ['transform', 'translate', 'scale'].some((key) => key in frame));
    const property = (animation as Partial<CSSTransition>).transitionProperty;
    const transition = property !== undefined && /transform|translate|scale/.test(property);
    return moves || transition ? [effect.pseudoElement ?? effect.target?.className ?? ''] : [];
  });
}

/** The parts that move: a screen with its header and content, a banner and a badge, a sheet. */
function stage() {
  const stageNode = document.createElement('main');
  stageNode.className = 'stage';
  const hud = document.createElement('div');
  hud.className = 'hud';
  const one = document.createElement('section');
  one.innerHTML = '<div class="screen-header">One</div><p>first</p>';
  const two = document.createElement('section');
  two.innerHTML = '<div class="screen-header">Two</div><p>second</p>';
  two.hidden = true;
  hud.append(one, two);
  stageNode.append(hud);
  const badge = document.createElement('span');
  badge.className = 'tab-bar-badge';
  badge.textContent = '1';
  const root = document.createElement('div');
  document.body.replaceChildren(stageNode, badge, root);
  const banner = createIncomingBanner(root, 'Challenge', {
    accept: () => Promise.resolve(),
    decline: () => Promise.resolve(),
    dismiss: () => undefined,
    later: () => undefined,
  });
  return {
    badge,
    banner,
    browse: () => {
      playScreenMotion('rise', () => {
        one.hidden = true;
        two.hidden = false;
      });
    },
  };
}

const invite = { token: 't', from: 'Alex', format: 'reveal', bestOf: 3, live: true } as const;

afterEach(async () => {
  await commands.reduceMotion(false);
});

describe('reduced motion', () => {
  it('moves nothing: screens, the sheet, the banner, its fold and the badge', async () => {
    await commands.reduceMotion(true);
    expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
    const page = stage();
    const seen: string[] = [];
    page.browse();
    await frame();
    seen.push(...moving());
    page.banner.show(challengeIncoming(invite, 1));
    await frame();
    seen.push(...moving());
    page.banner.fold(page.badge);
    await frame();
    seen.push(...moving());
    pulse(page.badge);
    await frame();
    seen.push(...moving());
    const sheet = createSheet({ id: 'reduced-sheet', title: 'Sheet' });
    document.body.append(sheet.element);
    sheet.open();
    await frame();
    seen.push(...moving());
    sheet.close();
    expect(seen).toStrictEqual([]);
  });

  it('with motion welcome, a browse move and the fold do move (the check can fail)', async () => {
    const page = stage();
    page.browse();
    await frame();
    const browsed = moving().length;
    page.banner.show(challengeIncoming(invite, 1));
    await frame();
    page.banner.fold(page.badge);
    await frame();
    expect({ browsed: browsed > 0, folded: moving().length > 0 }).toStrictEqual({
      browsed: true,
      folded: true,
    });
  });
});
