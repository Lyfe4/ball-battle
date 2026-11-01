import { defineBall } from '../define-ball.ts';

/** Small and fast: lands more full-speed hits, but can't take many. */
export const red = defineBall({
  id: 'red',
  name: 'Red',
  description: 'Placeholder ball with no ability.',
  color: '#ef4444',
  radius: 50,
  speed: 800,
  maxHealth: 75,
  contactDamage: 15,
  initialAbilityState: {},
  hooks: {},
});
