# Writing "What to watch"

The ready card's "What to watch:" line (ADR 0037) is the counter map's `reason` for the pair
(`src/sim/counter-map-*.ts`, ADR 0010, 0024). It is read while both balls stand still, often by a
player who has never seen either ball, so it says what they are about to see. Every reason follows
these rules (all 435 rewritten to them on 2026-11-22); `scripts/counter-map.test.ts` checks the
names, the verdict and the length.

1. **Name both balls.** "It" only for a ball named earlier in the same clause. A part only one of
   them has ("the spear", "the shield", "the wail") needs no owner.
2. **Say what to watch**, as something you can see happen: "the wail skips the shield", not "the
   Banshee ignores defences".
3. **No verdict.** The mark beside it already says who is favoured and how much: drop the
   trailing ": even." (92 reasons end with it) and words like "wins" or "loses".
4. **One idea per clause.** "But" only when the second clause outweighs the first.
5. **About 90 characters at most**, so it fits the ready card at 375 px in two lines.
6. **True in the fight.** Every claim must hold in the fight as the sim plays it, for both balls:
   check the definitions (`src/sim/balls/`) and the matchup's measured shape
   (`docs/balance-matrix.csv`), never memory.

## Examples

| Before                                                                   | After                                                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| The wail goes through the shield, and the spear comes back at it: even.  | The Banshee’s wail skips the Spartan’s shield, and the spear still lands on the Banshee.   |
| Each heavy bump it lands adds rage, but its big health holds out: even.  | The Balloon’s bumps hit harder, but each one feeds the Berserker’s rage for its next bump. |
| The spear is a shot, so it hits harder, and the shield halves its bumps. | The Spartan’s spear is a shot, which hits the Balloon harder, and the shield halves bumps. |
| Bump for bump with the growing Titan; neither floats nor shoots: even.   | The Titan grows and bumps harder as it goes; the Balloon’s float does nothing to bumps.    |

Why each after is true:

- **Banshee and Spartan** (88 characters): the wail is `unblockable`, so it skips the planted
  shield's halving (ADR 0075); the spear is an ordinary shot and still hits the Banshee.
- **Balloon and Berserker** (90): the Balloon bumps for 24 to the Berserker's 18.2, and every hit
  the Berserker takes stores rage (up to 3), which its next bump lets out (+3 a hit). The
  proposal's draft said the Balloon "has the health to outlast it", which is wrong: the Balloon
  has 76 health, the Berserker 88.
- **Spartan and Balloon** (90): every shot hits the Balloon for 140%, the spear included, and while
  the shield is planted every hit on the Spartan does half, the Balloon's bumps included.
- **Balloon and Titan** (87): the draft said "neither ability matters", but the Titan still grows
  and its bumps grow with it. What doesn't matter is the Balloon's float: it changes only area
  hits and shots, and the Titan only bumps.
