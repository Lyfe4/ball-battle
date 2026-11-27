// What each ball's arena tip points at (ADR 0036 addendum of 2026-11-23): declared in its
// definition (`ability.tipOn`), checked against the event that shows it, then found in real fights
// and read back as the rule it follows; and a zone's or a minion's ring goes when it does.
import { describe, expect, it } from 'vitest';
import { BALL_LOOKUP, BALLS } from '../sim/balls/index.ts';
import { getDefinition } from '../sim/definitions.ts';
import { step } from '../sim/step.ts';
import type { BallDefinition, SimEvent, TipOn, WorldState } from '../sim/types.ts';
import { createWorld } from '../sim/world.ts';
import { showsAbility } from './ability-sign.ts';
import { tipSpotOf, tipTargetOf, type TipTarget } from './tip-target.ts';

/** The events each `tipOn` can point from: a zone's needs a zone, a struck ball's a hit or status. */
const SHOWN_BY: Readonly<Record<TipOn, readonly string[] | undefined>> = {
  zone: ['zoneSpawned'],
  minion: ['minionSpawned'],
  struck: ['status', 'hookDamage'],
  copy: undefined,
  self: undefined,
};

type Rule = 'zone' | 'minion' | 'own ball' | 'struck ball' | 'copy';

/** The rule every ball's first tip follows in a real fight: the table in the ADR 0036 addendum. */
const RULES: Readonly<Record<string, Rule>> = {
  speedster: 'own ball',
  vampire: 'own ball',
  archer: 'own ball',
  storm: 'zone',
  frost: 'struck ball',
  thorns: 'own ball',
  venom: 'struck ball',
  berserker: 'own ball',
  sniper: 'own ball',
  hunter: 'zone',
  quake: 'own ball',
  magnet: 'own ball',
  ghost: 'own ball',
  necromancer: 'minion',
  chrono: 'own ball',
  tortoise: 'own ball',
  inferno: 'zone',
  boomerang: 'own ball',
  bomber: 'zone',
  spartan: 'own ball',
  bloom: 'own ball',
  hex: 'struck ball',
  spider: 'struck ball',
  battery: 'own ball',
  slime: 'own ball',
  balloon: 'own ball',
  banshee: 'own ball',
  kraken: 'struck ball',
  mirage: 'copy',
  jouster: 'own ball',
};

/** Plays `ball` against each other ball until its ability first shows: that tick's world and event. */
function firstShow(ball: BallDefinition): { world: WorldState; event: SimEvent } | undefined {
  const sign = ball.ability?.shownBy;
  if (sign === undefined) return undefined;
  for (const other of BALLS) {
    for (let seed = 0; seed < 3; seed++) {
      let world = createWorld(seed, [ball, other]);
      const self = world.balls[0];
      if (self === undefined) continue;
      for (let tick = 0; tick < 900 && world.match.status === 'running'; tick++) {
        const result = step(world, BALL_LOOKUP);
        world = result.world;
        const event = result.events.find((e) => showsAbility(e, self.id, sign));
        if (event !== undefined) return { world, event };
      }
    }
  }
  return undefined;
}

function ruleOf(ball: BallDefinition): Rule | undefined {
  const shown = firstShow(ball);
  const self = shown?.world.balls[0];
  if (shown === undefined || self === undefined || ball.ability === undefined) return undefined;
  const target = tipTargetOf(ball.ability.tipOn, shown.event, self, shown.world.balls);
  if (target.kind !== 'ball') return target.kind;
  return target.ballId === self.id ? 'own ball' : 'struck ball';
}

describe('where each ball’s tip goes', () => {
  it('is declared in every ball’s definition that has a tip, to match what shows it', () => {
    const wrong = BALLS.flatMap((ball) => {
      const ability = ball.ability;
      if (ability === undefined) return [];
      // A definition from outside the type checker (a frozen ruleset, a cast) can still leave it out.
      const tipOn = (ability as { readonly tipOn?: TipOn }).tipOn;
      if (tipOn === undefined) return [`${ball.id}: no tipOn`];
      const kinds = SHOWN_BY[tipOn];
      if (kinds !== undefined && !kinds.includes(ability.shownBy.kind)) {
        return [`${ball.id}: tipOn ${tipOn} but shown by ${ability.shownBy.kind}`];
      }
      if (tipOn === 'copy' && ball.decoyOf === undefined) return [`${ball.id}: no copy`];
      return [];
    });
    expect(wrong).toStrictEqual([]);
    // Only the balls with no ability have no tip.
    expect(BALLS.filter((ball) => ball.ability === undefined).map((ball) => ball.id)).toStrictEqual(
      ['brawler', 'titan'],
    );
  });

  it('follows its rule in a real fight, for every ball with a tip', () => {
    const found = Object.fromEntries(
      BALLS.filter((ball) => ball.ability !== undefined).map((ball) => [ball.id, ruleOf(ball)]),
    );
    expect(found).toStrictEqual(RULES);
  }, 60_000);

  it('puts a shot’s tip on the ball that fired it', () => {
    const archer = getDefinition(BALL_LOOKUP, 'archer');
    const shown = firstShow(archer);
    expect(shown?.event.type).toBe('projectileFired');
    const self = shown?.world.balls[0];
    if (shown === undefined || self === undefined) throw new Error('no arrow');
    const target = tipTargetOf('self', shown.event, self, shown.world.balls);
    expect(tipSpotOf(target, shown.world, BALL_LOOKUP)?.ballId).toBe(self.id);
  });

  it('lets a zone’s ring go once the zone strikes, and a minion’s once it is gone', () => {
    for (const id of ['bomber', 'storm', 'inferno', 'necromancer']) {
      const ball = getDefinition(BALL_LOOKUP, id);
      const shown = firstShow(ball);
      const self = shown?.world.balls[0];
      if (shown === undefined || self === undefined || ball.ability === undefined) {
        throw new Error(`${id} never showed`);
      }
      const target: TipTarget = tipTargetOf(ball.ability.tipOn, shown.event, self, []);
      expect(tipSpotOf(target, shown.world, BALL_LOOKUP), id).toBeDefined();
      const gone: WorldState = { ...shown.world, zones: [], minions: [] };
      expect(tipSpotOf(target, gone, BALL_LOOKUP), id).toBeUndefined();
    }
  });

  it('moves to a Slime’s other half when the one it named is knocked out', () => {
    const world = createWorld(1, [
      getDefinition(BALL_LOOKUP, 'slime'),
      getDefinition(BALL_LOOKUP, 'brawler'),
    ]);
    const [lead, brawler] = world.balls;
    if (lead === undefined || brawler === undefined) throw new Error('two balls');
    const half = { ...lead, id: 'ball-half', side: lead.id, position: { x: 700, y: 700 } };
    const target: TipTarget = { kind: 'ball', ballId: lead.id, key: 'slime' };
    const split = { ...world, balls: [{ ...lead, health: 0 }, brawler, half] };
    expect(tipSpotOf(target, split, BALL_LOOKUP)?.ballId).toBe('ball-half');
  });
});
