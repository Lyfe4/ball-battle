# What CI costs, and going private later

Measured 2026-11-23, to revisit near launch. The repository is public (still so on 2026-11-24:
#148 recorded the cost and changed nothing), so GitHub Actions minutes are free today. A private
repository on GitHub Pro gets 3,000 Linux minutes a month, billed per job with each job rounded
**up** to a whole minute.

## Measured: 2026-11-11 21:11 to 2026-11-23 12:00 UTC (11.6 days)

Every job of every run in that window (the latest attempt of each run), rounded up per job as a
private repository is billed:

| Workflow                                   | Runs | Minutes | Per run | Runs a day |
| ------------------------------------------ | ---: | ------: | ------: | ---------: |
| CI on pull requests                        |  179 |   9,374 |      52 |       15.4 |
| CI on `main` (merges)                      |  118 |   6,087 |      52 |       10.2 |
| Publish, Migrate, daily checks, Dependabot |   33 |      33 |       1 |        2.8 |
| **Total**                                  |      |  15,494 |         |            |

That is about **40,000 minutes a month** at this pace, 13 times Pro's 3,000. About 1.5 pull request
runs per merge (a push replaces a run in progress, so some are cut short).

A whole CI run costs more now than the window's average, about **65 minutes**:

| Job                             |     Minutes |
| ------------------------------- | ----------: |
| Lint, typecheck, test and build |           2 |
| Slow roster tests               |           3 |
| Balance check (150 seeds)       |         3.5 |
| API against a local Supabase    |           2 |
| A friend challenge in Chromium  |         ~18 |
| Browsers, 3 engines x 2 parts   | 6 x ~6 = 37 |

The online job took about 10 minutes for most of the window and about 18 since its twelfth file
(2026-11-22). At today's run cost and pace that is about 50,000 minutes a month. 3,000 a month is
about 1.5 whole runs a day.

## Options for going private

None of these alone fits today's pace (about 10 merges a day); combined with a slower pace they can.

1. **Trim CI.** Pull requests run Chromium only (the other four browser jobs report as skipped):
   about 44 minutes a run, 18 of them the online job. Firefox and WebKit run in a full CI run (about
   65 minutes) only before Publish, which requires a successful full run on the commit it publishes
   (`gh workflow run ci.yml`, then Publish once it passes), rather than on every merge. That fits
   about **35 merges a month** with about 8 publishes. Running the full suite on every push to
   `main` instead fits about 22. Mechanics to keep the ruleset happy:
   - The ruleset ("main: CI must pass") lists all 11 jobs by name, `strict` off. A job skipped by a
     job-level `if:` reports as passed, so a required check can be skipped without changing the
     ruleset.
   - But a **matrix** job skipped by a job-level `if:` reports once, under its unexpanded name
     (`Browsers in ${{ matrix.name }} (...)`), so the four required Firefox and WebKit checks would
     never report and every merge would wait forever. Skip them inside the job (each step's `if:`,
     about 1 billed minute each) or give them jobs of their own with literal names (0 minutes).
2. **A slower pace.** Fewer, larger pull requests: each merge costs about 1.5 PR runs, so batching
   the same work into a third as many PRs saves about two thirds.
3. **A self-hosted runner** (a machine of ours: Docker for Supabase, the browsers, always on). Its
   minutes don't count against the 3,000. Check GitHub's current pricing for self-hosted runners in
   private repositories first, and that the machine can run the online job's `netlify dev`.
4. **Paid minutes.** Raise the Actions spending limit above $0 and pay per Linux minute past the
   3,000 (check the current rate in GitHub's billing docs). Today's pace would be tens of thousands
   of paid minutes a month.
5. **A faster online job.** It is 18 of a run's 65 minutes and grows with every online file (12
   files of whole two-phone matches). Splitting it across jobs shortens the wait, not the minutes.
   What lowers minutes: fewer whole matches per file (shorter fights or Best of 3 where the flow
   doesn't need more), or running it only when a pull request touches online code (`src/server`,
   `src/api`, the online screens, `supabase/`), skipped inside the job as in option 1 so its check
   still reports.

Netlify is unaffected by any of this: it builds from its own credits (ADR 0052).
