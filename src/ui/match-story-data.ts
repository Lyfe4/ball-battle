// "How it was won" (ADR 0036, 0037): a finished match retold from its own events, as pure data. The
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

/** Why a moment is a key moment, in the order they are kept when there are too many. */
export type MomentKind = 'finish' | 'lead' | 'rule' | 'bigHit';

export interface Moment {
  readonly tick: number;
  readonly kind: MomentKind;
  /** A plain sentence: what happened, and to whom. */
  readonly text: string;
}

export interface MatchStory {
  /** Who won and how, in one line: "Titan knocked out Venom at 0:20". */
  readonly result: string;
  /** The winner first; in a draw, slot order. */
  readonly sides: readonly SideStory[];
  /** At most MAX_MOMENTS, in the order they happened. */
  readonly moments: readonly Moment[];
}

export const MAX_MOMENTS = 4;
/** A hit this big is a key moment on its own. */
export const BIG_HIT = 20;
/** Kept in this order when there are more than MAX_MOMENTS. */
const PRIORITY: readonly MomentKind[] = ['finish', 'lead', 'rule', 'bigHit'];

const RULE_WORDS: Readonly<Record<RuleId, (name: string) => string>> = {
  healCut: (name) => `Shock cut ${name}’s healing.`,
  aimHeld: (name) => `${name} was staggered and couldn’t aim.`,
  rageNumbed: (name) => `Poison numbed ${name}’s rage.`,
};

/** One ball's damage in words: its sources only when they say more than the total. */
export function sourceWords(side: SideStory): string {
  const many = side.sources.length > 1 || side.healed > 0;
  const words = many
    ? side.sources.map((share) => `${share.label} ${String(share.amount)}`)
    : side.sources.map((share) => (share.label === 'Hits' ? 'all hits' : `all ${share.label}`));
  if (side.healed > 0) {
    const cut = side.healsCut > 0 ? `, ${String(side.healsCut)} cut by shock` : '';
    words.push(`healed ${String(side.healed)}${cut}`);
  }
  return words.join(' · ');
}

/** A tick as the match clock reads it: "0:07". */
export function clockOf(tick: number): string {
  const seconds = Math.floor(tick / TICK_RATE);
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * The key moments to show (ADR 0037): what decided the round, at most `max`, in time order. Kept by
 * kind first (the finish; the winner taking the lead for good after trailing; each counter rule or
 * rewind the first time it acted; the round's biggest hit), then by time within a kind.
 */
export function chooseMoments(candidates: readonly Moment[], max = MAX_MOMENTS): Moment[] {
  const ranked = [...candidates].sort(
    (x, y) => PRIORITY.indexOf(x.kind) - PRIORITY.indexOf(y.kind) || x.tick - y.tick,
  );
  return ranked.slice(0, max).sort((x, y) => x.tick - y.tick);
}

/** Every event of the match, and each tick's health as a share of max health, by ball id. */
function replay(
  start: WorldState,
  lookup: DefinitionLookup,
): { events: SimEvent[]; shares: { tick: number; share: ReadonlyMap<string, number> }[] } {
  let world = start;
  const events: SimEvent[] = [];
  const shares: { tick: number; share: ReadonlyMap<string, number> }[] = [];
  const max = new Map(
    start.balls.map((ball) => [ball.id, lookup.get(ball.definitionId)?.maxHealth ?? 1]),
  );
  while (world.match.status === 'running') {
    const result = step(world, lookup);
    world = result.world;
    events.push(...result.events);
    shares.push({
      tick: world.tick,
      share: new Map(world.balls.map((ball) => [ball.id, ball.health / (max.get(ball.id) ?? 1)])),
    });
  }
  return { events, shares };
}

/**
 * When `winnerId` took the lead in health share for good, if the other ball was ever ahead before
 * that: the comeback that decided the round. Undefined when the winner was never behind.
 */
export function leadTakenAt(
  shares: readonly { tick: number; share: ReadonlyMap<string, number> }[],
  winnerId: string,
): number | undefined {
  let trailed = false;
  let since: number | undefined;
  for (const { tick, share } of shares) {
    const mine = share.get(winnerId) ?? 0;
    const others = [...share].filter(([id]) => id !== winnerId).map(([, value]) => value);
    const best = Math.max(...others);
    if (mine < best) {
      trailed = true;
      since = undefined;
    } else if (mine > best && since === undefined) {
      since = tick;
    }
  }
  return trailed ? since : undefined;
}

/** Starts a sentence with a capital: "your Titan hit …" reads "Your Titan hit …". */
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The story of the match that starts at `start`. `labels` names each slot's ball where its name
 * alone could be unclear: "your Titan" and "the bot’s Titan" in a series, "Titan A" and "Titan B"
 * in a Free play mirror.
 */
export function storyOf(
  start: WorldState,
  lookup: DefinitionLookup,
  labels?: readonly string[],
): MatchStory {
  const { events, shares } = replay(start, lookup);
  const nameOf = (ballId: string) => {
    const slot = start.balls.findIndex((b) => b.id === ballId);
    const ball = start.balls[slot];
    return (
      labels?.[slot] ??
      (ball === undefined ? undefined : lookup.get(ball.definitionId)?.name) ??
      ballId
    );
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
      name: sentence(nameOf(ball.id)),
      repeat: start.balls.slice(0, slot).some((b) => b.definitionId === ball.definitionId),
      won: ball.id === winnerId,
      dealt: dealt.reduce((sum, damage) => sum + damage.amount, 0),
      sources: [...byLabel.values()].sort((x, y) => y.amount - x.amount),
      healed,
      healsCut: events.filter((e) => e.type === 'healReduced' && e.ballId === ball.id).length,
    };
  });
  sides.sort((x, y) => Number(y.won) - Number(x.won));

  const loserId = start.balls.find((ball) => ball.id !== winnerId)?.id;
  const finishTick = ended?.tick ?? shares.at(-1)?.tick ?? 0;
  const knockout = ended?.type === 'matchEnded' && ended.reason === 'knockout';
  const result =
    winnerId === undefined || loserId === undefined
      ? knockout
        ? `Both knocked out at ${clockOf(finishTick)}: a draw`
        : 'Time up: a draw'
      : knockout
        ? `${nameOf(winnerId)} knocked out ${nameOf(loserId)} at ${clockOf(finishTick)}`
        : `Time up: ${nameOf(winnerId)} won with more health left`;

  const candidates: Moment[] = [];
  candidates.push({
    tick: finishTick,
    kind: 'finish',
    text:
      winnerId === undefined || loserId === undefined
        ? knockout
          ? 'Both balls were knocked out at once.'
          : 'Time ran out with the balls level.'
        : knockout
          ? `${nameOf(winnerId)} knocked ${nameOf(loserId)} out.`
          : `Time ran out with ${nameOf(winnerId)} ahead on health.`,
  });
  if (winnerId !== undefined) {
    const lead = leadTakenAt(shares, winnerId);
    // Taken only with the final blow, the finish already says it.
    if (lead !== undefined && lead < finishTick) {
      candidates.push({
        tick: lead,
        kind: 'lead',
        text: `${nameOf(winnerId)} pulled ahead for good after trailing.`,
      });
    }
  }
  const rulesSeen = new Set<string>();
  let biggest: DamageEvent | undefined;
  for (const event of events) {
    if (event.type === 'ruleApplied' && !rulesSeen.has(`${event.ballId}:${event.rule}`)) {
      rulesSeen.add(`${event.ballId}:${event.rule}`);
      candidates.push({
        tick: event.tick,
        kind: 'rule',
        text: RULE_WORDS[event.rule](nameOf(event.ballId)),
      });
    }
    if (event.type === 'rewound') {
      candidates.push({
        tick: event.tick,
        kind: 'rule',
        text: `${nameOf(event.ballId)} rewound its own knockout.`,
      });
    }
    if (
      event.type === 'damage' &&
      event.amount >= BIG_HIT &&
      event.amount > (biggest?.amount ?? 0)
    ) {
      biggest = event;
    }
  }
  if (biggest !== undefined) {
    const by =
      biggest.cause === 'contact'
        ? `${nameOf(biggest.sourceId)} hit ${nameOf(biggest.targetId)}`
        : `${nameOf(biggest.sourceId)}’s ${labelOf(biggest).toLowerCase()} hit ${nameOf(biggest.targetId)}`;
    candidates.push({
      tick: biggest.tick,
      kind: 'bigHit',
      text: `${by} for ${String(biggest.amount)}, the round’s biggest hit.`,
    });
  }
  const moments = chooseMoments(candidates).map((moment) => ({
    ...moment,
    text: sentence(moment.text),
  }));
  return { result: sentence(result), sides, moments };
}
