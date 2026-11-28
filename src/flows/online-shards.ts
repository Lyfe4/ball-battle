// Which CI shard runs each online flow (`*.online.test.ts`): CI's online job runs as three shards
// in parallel, each with its own local Supabase and `netlify dev`, and a job with the old required
// name passes only if all three do. Files are spread by measured time, not by count: each shard's
// files add up to about the same. The seconds are each file's median over six green CI runs
// (2026-11-26; challenge-on-end estimated); re-balance when a shard runs much longer than the others.
// `online-shards.test.ts` fails when a file is in no shard or in two, so a new flow always runs.
// CI imports `shardFiles` (node strips the types) and passes that shard's files to `vitest run`.

/** Each shard's files, by name in src/flows, with their measured seconds. */
export const ONLINE_SHARDS: readonly (readonly (readonly [file: string, seconds: number])[])[] = [
  [
    ['live-match-blocked.online.test.ts', 307],
    ['rematch.online.test.ts', 100],
    ['inbox-poke.online.test.ts', 94],
    ['rematch-anywhere.online.test.ts', 59],
    ['live-sync.online.test.ts', 23],
    // Measured locally (2026-11-28): three two-phone flows, two waiting out a minute and 30 s.
    ['pair-invite.online.test.ts', 160],
  ],
  [
    ['live-match.online.test.ts', 230],
    ['lineups-together.online.test.ts', 158],
    ['challenge-on-end.online.test.ts', 120],
    ['sign-in.online.test.ts', 18],
    // Measured locally (2026-11-29): three phones asleep past a clock, a minute or more each.
    ['phone-sleep.online.test.ts', 240],
  ],
  [
    ['slime-live.online.test.ts', 167],
    ['friend-challenge.online.test.ts', 134],
    ['friend-rematch.online.test.ts', 121],
    ['coin-toss.online.test.ts', 36],
    ['turns.online.test.ts', 24],
    ['rematch-yes-away.online.test.ts', 12],
    ['friends.online.test.ts', 12],
    ['online-failures.online.test.ts', 5],
    // Estimated (2026-11-28): one two-phone flow through a lineup, offline and back, about 40 s.
    ['offline-lineup.online.test.ts', 40],
    // Estimated (2026-11-27): six two-phone flows with sign-ins, about a minute each.
    ['friend-states.online.test.ts', 120],
    // Estimated (2026-11-27): one two-phone flow with two sign-ins, about 90 s.
    ['one-game.online.test.ts', 90],
    // Measured locally (2026-11-29): four two-phone flows, each ended by a Leave.
    ['leave-and-return.online.test.ts', 38],
  ],
];

/** The files of shard `n` (1-based), as paths `vitest run` takes. */
export function shardFiles(n: number): string[] {
  const shard = ONLINE_SHARDS[n - 1];
  if (shard === undefined) throw new Error(`No online shard ${String(n)}`);
  return shard.map(([file]) => `src/flows/${file}`);
}
