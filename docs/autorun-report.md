# Autorun report (2026-11-04)

Unattended run over four stages. Each stage has what was done, decisions made on your behalf
(with the alternatives), questions for you, and anything I'm unsure about.

## Starting state

1. **Balls (5, all radius 50):** Brawler (no ability, hardest hitter, 26 dmg / 64 hp / 740),
   Speedster (stacks speed and bonus damage off walls, 14 / 70 / 800), Vampire (40% lifesteal,
   22 / 60 / 760), Archer (leading arrow every 2 s, 6 / 50 / 780), Storm (telegraphed lightning
   zone every ~2.2 s, 13 / 74 / 720).
2. **Tick order (ADR 0008):** onTick → move + seeded wall turn → onWallHit → collide → contact
   damage (new contacts, scaled by directness, lethal tiebreak) → onHitBall → projectiles → zones
   → onDamageDealt → defeats → cruise speed → contacts and match end.
3. **Balance targets:** every ball 40-60% overall, no matchup worse than 20/80, draws < 5%,
   median match 12-30 s, ±5% health moves win rates ≤ 15 pts (warn) / 20 (fail), Vampire heals
   ≥ 25% of max health per match.
4. **Latest balance (500 seeds, re-run at 8fd9ac3):** all targets pass. Per ball 47.8-53.3%;
   worst matchup Speedster vs Archer 67.2/32.8; draws 0.3%; median 14.6 s; worst sensitivity
   7.3 pts; Vampire heals 32.6% of max.
5. **Counters:** Speedster > Archer (67/33), Vampire > Speedster (60/40), Speedster ≥ Storm
   (58/42), Archer ≥ Brawler and Vampire (57/43). No ADR 0007 exists yet; battle feel had no
   plan in the repo, so Stage 2 uses the spec from the run prompt.

## Stage 1: vision note

Plan: add `docs/vision.md` with the PvP mode, the soft-counter goal, the future targets and the
planned order; one-line pointer in `CLAUDE.md`. No code.

Done: `docs/vision.md` written as specified; `CLAUDE.md` points to it just under the intro.

Decisions on your behalf:

- Put the pointer under the project intro rather than in the ADR list, since it's not a
  decision record. Alternative: a "Docs" list at the end.
- Wrote the future targets as "not enforced today" so nobody tightens `pnpm balance` early.

Questions: none.
