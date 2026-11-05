# 0023: Known match results, checked in every engine

- Status: Accepted
- Date: 2026-11-05
- Amends: ADR 0001 (cross-engine determinism is now tested), ADR 0022 (the step it left open)

## Context

ADR 0001 claims a match is the same in every browser because the sim uses only arithmetic that
IEEE 754 rounds exactly. Until now that claim was only argued, never tested:

- `determinism.slow.test.ts` plays every matchup twice in one Node process. It catches hidden
  state, but not a change that is deterministic and different, and never runs another engine.
- `ruleset.test.ts` (ADR 0022) hashes the results of one match per pair into one fingerprint. It
  says that some fight changed, but not which, and it runs only in Node.

The PvP plan (`docs/vision.md`) has a server re-simulating what a player's browser played. The
player may be on Chrome (V8), Firefox (SpiderMonkey) or Safari (JavaScriptCore); the server will be
Node (V8). If any of them computes a different fight, a fair result is rejected. The audit of
2026-11-05 (H2) asked for a record of known results and a run in real browser engines.

## Decision

### 1. A committed record of known results

`src/golden/golden-matches.json` records 132 matches: every pair of balls once, mirrors included,
at two seeds each. The seeds are spread over the whole 32-bit range by a multiplicative hash, with
0 and 0xffffffff included. For each match it stores the winner's slot, the end tick and a SHA-256
of the final world and every event of the match.

- The hash input is `JSON.stringify` of `{ world, events }`, with `-0` written as `"-0"` so a sign
  difference can't hide. JSON number formatting (shortest round-trip) and property order are fixed
  by the language spec, so the text is the same in every engine whenever the values are.
- Hashing uses Web Crypto (`crypto.subtle`), which Node and every browser have. That is why the
  code lives in `src/golden/`, not `src/sim/`: it only reads the sim, and the sim has no crypto.
- `golden.test.ts` fails per match, naming the pair, seed, winner, end tick and hash it got and the
  ones on record, so a failure says where to look.

### 2. Tied to the ruleset version

The record holds the `RULESET_VERSION` it was made under, and the test fails when that differs
from today's: "run `pnpm golden`". `pnpm golden` (`scripts/golden.ts`) rewrites the record, but
refuses while the version is unchanged and the results differ. Results that move without a bump
are either an accidental rules change (which `ruleset.test.ts` also catches) or a refactor that
reordered floating-point work. Both need finding, not recording. The record only moves with a
deliberate bump.

### 3. The same test in Chromium, Firefox and WebKit

A third Vitest project, `browsers`, runs `golden.test.ts` unchanged in headless Chromium, Firefox
and WebKit through `@vitest/browser-playwright` (`pnpm test:browsers`). So every recorded match is
checked in V8 (Node and Chromium), SpiderMonkey and JavaScriptCore. The record is imported, so
the browser needs no file access. A fourth CI job runs it.

I chose Vitest's browser mode over a Playwright test that drives a page, because it runs the same
test file the unit suite runs: one definition of "the same match", four runtimes. Every match, not
a sample, runs in each engine, because a full run takes about half a second per engine.

### 4. If an engine disagrees

The failing engine's results are the finding, not the record. Nobody regenerates the record to
make it pass, and the sim isn't changed for one engine without a new ADR. Find the first tick
where that engine's world differs from Node's and the operation that produced it.

## Result

All four runtimes agree on all 132 matches: Node 24, and Chromium, Firefox and WebKit from
Playwright 1.64.1, both on Windows 11 locally and on `ubuntu-latest` in CI. ADR 0001's
cross-engine claim is now tested on every push.

To show the check can fail, I raised the Brawler's speed by one unit: the test named each changed
match, and `pnpm golden` refused to record it without a bump. I also changed one recorded end tick
by one, and all three browsers failed.

## Cost in CI

The `browsers` job runs in parallel with the other three (about 50 s each), so it sets the
pipeline's wall time. Measured on its first three runs:

| Run               | Job   | Browsers                         | System libraries (apt) | Tests |
| ----------------- | ----- | -------------------------------- | ---------------------- | ----- |
| Cold cache        | 85 s  | 51 s (download and apt together) | (included)             | 7 s   |
| Warm cache        | 101 s | 7 s (cache restore)              | 65 s                   | 6 s   |
| Warm, slow mirror | 283 s | 9 s (cache restore)              | 241 s                  | 7 s   |

The browser cache (`~/.cache/ms-playwright`, keyed on the Playwright version, since each release
pins its own browser builds) works, but it doesn't save much: Playwright's CDN is fast, and
WebKit's system libraries (GStreamer and friends) come from apt on every run, because a cache
can't install system packages. The apt step dominates and varies with the Azure mirror. If it
becomes a problem, the next step is Playwright's Docker image, which has the libraries baked in,
at the cost of pulling the image.

## Consequences

- Positive: the cross-engine claim the PvP server rests on is tested on every push, per match,
  in all three engines players use.
- Positive: a refactor that changes any recorded fight without a ruleset bump fails with the
  match it changed.
- Negative: every ruleset bump now needs `pnpm golden` as well as a new fingerprint.
- Negative: CI's wall time goes from about 50 s to about 90-100 s, more when the apt mirror is
  slow, and local `pnpm test:browsers` needs the three browsers installed once.
- Limits: Playwright's WebKit is JavaScriptCore on Linux and Windows, not Safari on Apple
  hardware, and nothing runs on a phone. Correctly rounded arithmetic doesn't depend on the CPU,
  so the remaining risk is an engine bug, not a platform difference. The check covers the match
  sim, not series or bot choices, which use only integer arithmetic and the seeded PRNG.
