import { defineBall } from '../define-ball.ts';

/** Big and slow: heavier (mass is radius squared), tougher, and hits harder when it connects. */
export const blue = defineBall({
  id: 'blue',
  name: 'Blue',
  description: 'Placeholder ball with no ability.',
  color: '#3b82f6',
  radius: 76,
  speed: 560,
  maxHealth: 85,
  contactDamage: 17,
  initialAbilityState: {},
  hooks: {},
});
