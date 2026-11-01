import { defineBall } from '../define-ball.ts';

/** The baseline: no ability, just solid stats. Every other ball is balanced against this one. */
export const brawler = defineBall({
  id: 'brawler',
  name: 'Brawler',
  description: 'No tricks. Hits hard and takes a beating.',
  color: '#ef4444',
  radius: 56,
  speed: 760,
  maxHealth: 80,
  contactDamage: 20,
  initialAbilityState: {},
  hooks: {},
});
