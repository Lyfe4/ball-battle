// Counter-map entries for batch 5, first half: the Boomerang and the Bomber with every earlier ball
// (ADR 0043). The map is in counter-map.ts; its checks in scripts/counter-map.ts.
import type { CounterEntry } from './counter-map.ts';

/**
 * Each counter was measured before it was kept (ADR 0043). A boomerang chips twice a throw from
 * range, so phasing and fire answer it poorly; a fast ball outruns it, a bigger body wins the
 * trades and a skull stops it dead. Bombs punish whoever covers the most ground, and a ball that
 * shoots from range crosses them least.
 * Every pair with the Storm, Quake, Berserker, Vampire, Archer, Sniper or Boomerang moved to the
 * counter-map-rules-out-*.ts files with ADR 0045, which removed the interaction rules, and every
 * other pair with the Chrono, Guardian, Ghost, Bloom or Venom to counter-map-hit-kinds-*.ts with
 * the redesign's second group.
 */
export const BATCH_FIVE_ENTRIES: readonly CounterEntry[] = [
  // The Boomerang.
  // The Bomber.
  {
    x: 'brawler',
    y: 'bomber',
    intended: 'even',
    reason: 'It runs into bombs like anyone, and hits hard when it gets there.',
  },
  {
    x: 'bomber',
    y: 'speedster',
    intended: 'x',
    reason: 'The fastest ball covers the most ground, so it runs into the most bombs.',
  },
  {
    x: 'frost',
    y: 'bomber',
    intended: 'even',
    reason: 'The slowest ball runs into few bombs, but it can’t outrun a blast either.',
  },
  {
    x: 'thorns',
    y: 'bomber',
    intended: 'even',
    reason: 'A blast never touches the spikes, but the Bomber’s own hits are light.',
  },
  {
    x: 'magnet',
    y: 'bomber',
    intended: 'even',
    reason: 'The pull drags it across the bombs, and its heavy hits pay them back.',
  },
  {
    x: 'necromancer',
    y: 'bomber',
    intended: 'even',
    reason: 'A blast clears a skull, but a new one rises soon after: neither side gains.',
  },
  {
    x: 'titan',
    y: 'bomber',
    intended: 'even',
    reason: 'A growing giant sets off more bombs, and its growing bumps pay them back.',
  },
  {
    x: 'inferno',
    y: 'bomber',
    intended: 'even',
    reason: 'Fire and bombs both lie in wait behind them, and each crosses the other’s.',
  },
];
