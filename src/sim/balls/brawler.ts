import { defineBall } from '../define-ball.ts';

/** The baseline: no ability, just solid stats. Every other ball is balanced against this one. */
export const brawler = defineBall({
  id: 'brawler',
  name: 'Brawler',
  description: 'No tricks. Hits hard and takes a beating.',
  color: '#ef4444',
  radius: 50,
  speed: 800,
  maxHealth: 75,
  contactDamage: 15,
  initialAbilityState: {},
  hooks: {},
});
