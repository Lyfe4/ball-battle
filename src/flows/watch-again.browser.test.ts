// A finished online series opened later (from Profile's Recent matches, ADR 0088): its result with
// Watch again, which plays its rounds again from round 1 as a series by turns does, Home beside it;
// a series under a ruleset whose fights don't replay here shows its result, one line saying why,
// and no Watch again.
import { describe, expect, it } from 'vitest';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { liveSeries, rematch } from './online-views-support.ts';
import { button, settle, until, visible } from './page-support.ts';
import { follow, openAs, type Answers } from './shell-routes-support.ts';

const NOW = Date.now();
const TODAY = '11111111-2222-4333-8444-5555555555a1';
const OLDER = '11111111-2222-4333-8444-5555555555a2';
/** No rematch any more: the series ended long ago. */
const ENDED = { ...rematch('none', NOW), offered: false };

const shown = (name: string) =>
  visible('#online-series button').find((node) => node.textContent.trim() === name);

describe('a finished online series, opened later (ADR 0088)', () => {
  it('offers Watch again, which plays it again from round 1; an older one says why it can’t', async () => {
    const answers: Answers = {
      [`/api/v1/series/${TODAY}`]: await liveSeries(TODAY, true, NOW),
      [`/api/v1/series/${TODAY}/rematch`]: ENDED,
      [`/api/v1/series/${OLDER}`]: await liveSeries(OLDER, true, NOW, RULESET_VERSION - 1),
      [`/api/v1/series/${OLDER}/rematch`]: ENDED,
    };
    await openAs({ online: true, accounts: true }, '', answers);

    await follow(`?online=${TODAY}`);
    await until(() => shown('Watch again') !== undefined, 8_000, 'Watch again', false);
    await settle();
    // One primary: Watch again; Home beside it, secondary.
    expect(shown('Watch again')?.classList.contains('hud-button-primary')).toBe(true);
    expect(shown('Home')?.classList.contains('hud-button-primary')).toBe(false);
    shown('Watch again')?.click();
    await until(() => shown('Play round 1') !== undefined, 5_000, 'Play round 1', false);
    expect(shown('Watch again')).toBeUndefined();
    button('Play round 1').click();
    // Round 1 is fought on the arena: Play round 1 gives way to the fight.
    await until(() => shown('Play round 1') === undefined, 5_000, 'round 1 playing', false);

    await follow(`?online=${OLDER}`);
    await until(
      () =>
        visible('#online-series .series-note').some((node) =>
          node.textContent.includes('older version'),
        ),
      8_000,
      'the older-version line',
      false,
    );
    expect(visible('#online-series .series-result').length).toBeGreaterThan(0);
    expect(shown('Watch again')).toBeUndefined();
    expect(shown('Home')?.classList.contains('hud-button-primary')).toBe(true);
  });
});
