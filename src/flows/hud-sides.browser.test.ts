// The real page in a real browser (`pnpm test:browsers`): a Slime split in two is one side, so the
// HUD's bar and its health read the two halves added up (ADR 0059, 0060).
import { describe, expect, it } from 'vitest';
import page from '../../index.html?raw';
import { BALL_LOOKUP } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import { RULESET_VERSION } from '../sim/ruleset.ts';
import { sideHealth } from '../sim/side.ts';
import { step } from '../sim/step.ts';
import { createWorld } from '../sim/world.ts';
import { settle, until, visible } from './page-support.ts';

/** Seed 5: the Slime splits, then wins with both halves still standing. */
const SEED = 5;

function finalWorld() {
  const pair = [getDefinition(BALL_LOOKUP, 'slime'), getDefinition(BALL_LOOKUP, 'archer')];
  let world = createWorld(SEED, pair);
  while (world.match.status === 'running') world = step(world, BALL_LOOKUP).world;
  return world;
}

const slimeHealth = () => visible('.hud-ball')[0]?.querySelector('.hud-ball-health')?.textContent;

describe('the HUD for a Slime split in two', () => {
  it('reads its side’s total health before and after the split', async () => {
    window.localStorage.setItem('ballbattle.speed', '2');
    const body = new DOMParser().parseFromString(page, 'text/html').body;
    document.body.replaceChildren(...body.children);
    const start = new URL(location.href);
    start.search = `?a=slime&b=archer&seed=${String(SEED)}&v=${String(RULESET_VERSION)}`;
    history.replaceState(null, '', start);
    await import('../main.ts');
    await settle();

    const end = finalWorld();
    const [whole, , half] = end.balls;
    const total = sideHealth(end.balls, 'ball-0');
    // The case this seed was chosen for: two halves standing, so the total is neither alone.
    expect(whole !== undefined && whole.health > 0 && half !== undefined && half.health > 0).toBe(
      true,
    );
    expect(total).toBe((whole?.health ?? 0) + (half?.health ?? 0));

    expect(visible('.hud-ball')).toHaveLength(2);
    expect(slimeHealth()).toBe('76 / 76');
    await until(
      () => visible('.hud-ball[data-outcome="won"]').length === 1,
      60_000,
      'the Slime to win',
    );
    // Still one row a side, and the Slime's reads both halves together.
    expect(visible('.hud-ball')).toHaveLength(2);
    expect(slimeHealth()).toBe(`${String(Math.ceil(total))} / 76`);
    const fill = visible('.hud-health-fill')[0];
    expect(Number.parseFloat(fill?.style.width ?? '')).toBeCloseTo((total / 76) * 100, 2);
  }, 90_000);
});
