import type { BallDefinition } from '../types.ts';

/** Big and slow: heavier (mass is radius squared), tougher, and hits harder when it connects. */
export const blue: BallDefinition = {
  id: 'blue',
  name: 'Blue',
  color: '#3b82f6',
  radius: 76,
  speed: 560,
  maxHealth: 85,
  contactDamage: 17,
};
