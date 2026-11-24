// The hidden rating of ranked play (ADR 0083): Glicko-2 as Glickman's paper gives it
// (http://www.glicko.net/glicko/glicko2.pdf, 2022), with one rating period per finished ranked
// series, as Lichess does. Pure. Server-only: `Math.exp` and `Math.log` may differ between engines
// in their last bits, which is fine here, since a rating is computed once, in one transaction, and
// stored, never recomputed elsewhere (ADR 0052). Never imported by `src/sim`.

/** A player's rating on the familiar scale: rating, rating deviation (RD) and volatility. */
export interface Glicko {
  readonly rating: number;
  readonly rd: number;
  readonly volatility: number;
}

/** One result in a rating period: the opponent as they were before it, and 1, 0.5 or 0. */
export interface GlickoResult {
  readonly opponent: Glicko;
  readonly score: number;
}

/** ADR 0052's parameters, kept by ADR 0083. */
export const GLICKO = {
  start: { rating: 1500, rd: 350, volatility: 0.06 },
  /** The system constant: how much volatility may change (Glickman suggests 0.3 to 1.2). */
  tau: 0.5,
  /** The volatility iteration's tolerance (Glickman's step 5). */
  epsilon: 0.000001,
  /** No one is less known than a new player: RD never grows past this. */
  maxRd: 350,
} as const;

/** The Glicko-2 scale's factor: 400 / ln 10. */
const SCALE = 173.7178;
const PI_SQUARED = Math.PI * Math.PI;

const g = (phi: number): number => 1 / Math.sqrt(1 + (3 * phi * phi) / PI_SQUARED);
const expected = (mu: number, muJ: number, phiJ: number): number =>
  1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

/** The new volatility (Glickman's step 5, the Illinois algorithm). */
function volatilityAfter(phi: number, sigma: number, v: number, delta: number): number {
  const { tau, epsilon } = GLICKO;
  const a = Math.log(sigma * sigma);
  const f = (x: number): number => {
    const ex = Math.exp(x);
    const top = ex * (delta * delta - phi * phi - v - ex);
    const bottom = 2 * (phi * phi + v + ex) * (phi * phi + v + ex);
    return top / bottom - (x - a) / (tau * tau);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k += 1;
    B = a - k * tau;
  }
  let fA = f(A);
  let fB = f(B);
  // Each pass at least halves the bracket's side that moved, so this ends well within 100 passes.
  for (let pass = 0; Math.abs(B - A) > epsilon && pass < 100; pass += 1) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  return Math.exp(A / 2);
}

/**
 * `player` after one rating period with `results` (Glickman's steps 1 to 8). With no results, only
 * the RD grows, by one period's volatility. RD is capped at GLICKO.maxRd.
 */
export function rate(player: Glicko, results: readonly GlickoResult[]): Glicko {
  const mu = (player.rating - 1500) / SCALE;
  const phi = player.rd / SCALE;
  const sigma = player.volatility;
  if (results.length === 0) return { ...player, rd: capped(Math.sqrt(phi * phi + sigma * sigma)) };
  let vInverse = 0;
  let sum = 0;
  for (const { opponent, score } of results) {
    const muJ = (opponent.rating - 1500) / SCALE;
    const phiJ = opponent.rd / SCALE;
    const e = expected(mu, muJ, phiJ);
    vInverse += g(phiJ) * g(phiJ) * e * (1 - e);
    sum += g(phiJ) * (score - e);
  }
  const v = 1 / vInverse;
  const delta = v * sum;
  const sigmaAfter = volatilityAfter(phi, sigma, v, delta);
  const phiStar = Math.sqrt(phi * phi + sigmaAfter * sigmaAfter);
  const phiAfter = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muAfter = mu + phiAfter * phiAfter * sum;
  return {
    rating: SCALE * muAfter + 1500,
    rd: capped(phiAfter),
    volatility: sigmaAfter,
  };
}

/** RD on the familiar scale from φ, capped. */
const capped = (phi: number): number => Math.min(GLICKO.maxRd, SCALE * phi);

/**
 * `player` after `days` without a ranked series (ADR 0083): φ' = √(φ² + σ²·d), a day being one
 * rating period of no games, capped at GLICKO.maxRd. Applied before each update, from
 * `last_series_at`; whole days only, so a few hours' gap changes nothing.
 */
export function afterInactivity(player: Glicko, days: number): Glicko {
  const d = Math.max(0, Math.floor(days));
  if (d === 0) return player;
  const phi = player.rd / SCALE;
  const sigma = player.volatility;
  return { ...player, rd: capped(Math.sqrt(phi * phi + sigma * sigma * d)) };
}

/** The conservative skill S = rating − 2·RD: the board's tie-break and the queue's key. */
export const skillOf = (player: Glicko): number => player.rating - 2 * player.rd;
