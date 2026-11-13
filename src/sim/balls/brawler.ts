import { STANDARD_BALL_RADIUS } from '../constants.ts';
import { defineBall } from '../define-ball.ts';

/** The baseline: no ability, just solid stats. Every other ball is balanced against this one. */
export const brawler = defineBall({
  id: 'brawler',
  name: 'Brawler',
  description: 'No tricks. Hits hard and takes a beating.',
  color: '#ef4444',
  howItWorks: [
    'No ability: just its bump.',
    'Like every ball’s, its bump does full damage head-on and less when it glances.',
  ],
  radius: STANDARD_BALL_RADIUS,
  speed: 770,
  maxHealth: 66,
  contactDamage: 26,
  initialAbilityState: {},
  hooks: {},
});
