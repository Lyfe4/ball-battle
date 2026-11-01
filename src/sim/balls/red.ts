import type { BallDefinition } from '../types.ts';

/** Small and fast: lands more full-speed hits, but can't take many. */
export const red: BallDefinition = {
  id: 'red',
  name: 'Red',
  color: '#ef4444',
  radius: 50,
  speed: 800,
  maxHealth: 75,
  contactDamage: 15,
};
