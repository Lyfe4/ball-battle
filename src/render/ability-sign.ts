// Whether a sim event is the moment a ball's ability shows (ADR 0036), read from its definition's
// `ability.shownBy`. Pure, so the hints in the arena are tested without a DOM, and they can only
// ever point at something the sim actually did.
import type { AbilitySign, DamageEvent, SimEvent } from '../sim/types.ts';

export function showsAbility(event: SimEvent, ballId: string, sign: AbilitySign): boolean {
  switch (sign.kind) {
    case 'projectileFired':
    case 'zoneSpawned':
    case 'minionSpawned':
      return event.type === sign.kind && event.ownerId === ballId;
    case 'rewound':
    case 'healed':
      return event.type === sign.kind && event.ballId === ballId;
    case 'status':
      return (
        event.type === 'statusApplied' && event.sourceId === ballId && event.status === sign.status
      );
    case 'hookDamage':
      return event.type === 'damage' && event.sourceId === ballId && event.via === sign.hook;
    case 'hook':
      return (
        event.type === 'abilityTriggered' && event.ballId === ballId && event.hook === sign.hook
      );
  }
}

/**
 * Damage whose cause isn't on screen when it lands (ADR 0036): poison between contacts, a burning
 * patch's later pulses, and damage dealt back by a ball that was hit (the Thorns' spikes).
 * Arrows, strikes, skulls and contact hits show their cause already.
 */
export function isUnseenDamage(damage: DamageEvent): boolean {
  return damage.via === 'poison' || damage.via === 'zonePulse' || damage.via === 'onDamageTaken';
}
