// "How it was won" (ADR 0036): a finished match retold from its own events, as pure data. The
// match is replayed headlessly from its opening world, which is (seed, balls), so the story is
// the fight itself and can never disagree with what was on screen (ADR 0001).
import type { RuleId } from '../sim/rules.ts';
import { TICK_RATE } from '../sim/constants.ts';
import { step } from '../sim/step.ts';
import type { DamageEvent, DefinitionLookup, SimEvent, WorldState } from '../sim/types.ts';

/** Damage one ball dealt by one source: its contact hits, or its ability. */
export interface DamageShare {
  readonly label: string;
  readonly amount: number;
  readonly ability: boolean;
}

export interface SideStory {
  readonly ballId: string;
  readonly definitionId: string;
  readonly name: string;
  /** A mirror's second ball, drawn in the lighter shade as in the arena. */
  readonly repeat: boolean;
  readonly won: boolean;
  readonly dealt: number;
  /** Largest first. */
  readonly sources: readonly DamageShare[];
  readonly healed: number;
  /** Heals cut by shock (ADR 0028's rule cue). */
  readonly healsCut: number;
}

export interface Moment {
  readonly tick: number;
  readonly text: string;
}

export interface MatchStory {
  /** The winner first; in a draw, slot order. */
  readonly sides: readonly SideStory[];
  /** At most MAX_MOMENTS, in the order they happened. */
  readonly moments: readonly Moment[];
}

export const MAX_MOMENTS = 4;
/** A hit this big is a key moment on its own. */
const BIG_HIT = 20;

const RULE_WORDS: Readonly<Record<RuleId, (name: string) => string>> = {
  healCut: (name) => `Shock cut ${name}’s heal`,
  aimHeld: (name) => `${name} couldn’t aim`,
  rageNumbed: (name) => `Poison numbed ${name}’s rage`,
};

/** Plays `start` to its end and returns every event, in order. */
function playEvents(start: WorldState, lookup: DefinitionLookup): SimEvent[] {
  let world = start;
  const events: SimEvent[] = [];
  while (world.match.status === 'running') {
    const result = step(world, lookup);
    world = result.world;
    events.push(...result.events);
  }
  return events;
}

export function storyOf(start: WorldState, lookup: DefinitionLookup): MatchStory {
  const events = playEvents(start, lookup);
  const nameOf = (ballId: string) => {
    const ball = start.balls.find((b) => b.id === ballId);
    return (ball === undefined ? undefined : lookup.get(ball.definitionId)?.name) ?? ballId;
  };
  const labelOf = (damage: DamageEvent) => {
    if (damage.cause === 'contact') return 'Hits';
    const ball = start.balls.find((b) => b.id === damage.sourceId);
    return (
      (ball === undefined ? undefined : lookup.get(ball.definitionId)?.ability?.name) ?? 'Ability'
    );
  };
  const ended = events.find((event) => event.type === 'matchEnded');
  const winnerId =
    ended?.type === 'matchEnded' && ended.result.kind === 'win' ? ended.result.winnerId : undefined;

  const sides = start.balls.map((ball, slot): SideStory => {
    const dealt = events.filter(
      (event): event is DamageEvent => event.type === 'damage' && event.sourceId === ball.id,
    );
    const byLabel = new Map<string, DamageShare>();
    for (const damage of dealt) {
      const label = labelOf(damage);
      const before = byLabel.get(label)?.amount ?? 0;
      byLabel.set(label, {
        label,
        amount: before + damage.amount,
        ability: damage.cause !== 'contact',
      });
    }
    const healed = events.reduce(
      (sum, event) =>
        event.type === 'healed' && event.ballId === ball.id ? sum + event.amount : sum,
      0,
    );
    return {
      ballId: ball.id,
      definitionId: ball.definitionId,
      name: nameOf(ball.id),
      repeat: start.balls.slice(0, slot).some((b) => b.definitionId === ball.definitionId),
      won: ball.id === winnerId,
      dealt: dealt.reduce((sum, damage) => sum + damage.amount, 0),
      sources: [...byLabel.values()].sort((x, y) => y.amount - x.amount),
      healed,
      healsCut: events.filter((e) => e.type === 'healReduced' && e.ballId === ball.id).length,
    };
  });
  sides.sort((x, y) => Number(y.won) - Number(x.won));
  return { sides, moments: momentsOf(events, nameOf, labelOf) };
}

function momentsOf(
  events: readonly SimEvent[],
  nameOf: (ballId: string) => string,
  labelOf: (damage: DamageEvent) => string,
): Moment[] {
  const ending: Moment[] = [];
  const turns: Moment[] = [];
  const rulesSeen = new Set<string>();
  let biggest: DamageEvent | undefined;
  for (const event of events) {
    if (
      event.type === 'damage' &&
      event.amount >= BIG_HIT &&
      event.amount > (biggest?.amount ?? 0)
    ) {
      biggest = event;
    }
    if (event.type === 'ruleApplied' && !rulesSeen.has(`${event.ballId}:${event.rule}`)) {
      rulesSeen.add(`${event.ballId}:${event.rule}`);
      turns.push({ tick: event.tick, text: RULE_WORDS[event.rule](nameOf(event.ballId)) });
    }
    if (event.type === 'rewound') {
      turns.push({ tick: event.tick, text: `${nameOf(event.ballId)} rewound a knockout` });
    }
    if (event.type === 'ballDefeated') {
      ending.push({ tick: event.tick, text: `${nameOf(event.ballId)} knocked out` });
    }
    if (event.type === 'matchEnded' && event.reason !== 'knockout') {
      ending.push({ tick: event.tick, text: 'Time up' });
    }
  }
  const big =
    biggest === undefined
      ? []
      : [
          {
            tick: biggest.tick,
            text: `${nameOf(biggest.sourceId)}’s ${labelOf(biggest).toLowerCase()} −${String(biggest.amount)}`,
          },
        ];
  // The ending and the biggest hit always; the earliest turns of the fight fill the rest.
  const room = Math.max(0, MAX_MOMENTS - ending.length - big.length);
  return [...turns.slice(0, room), ...big, ...ending].sort((x, y) => x.tick - y.tick);
}

/** A tick as the match clock reads it: "0:07". */
export function clockOf(tick: number): string {
  const seconds = Math.floor(tick / TICK_RATE);
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}
