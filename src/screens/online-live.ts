// PROTOTYPE (proto/live-friend-matches, ADR 0053 draft): a live series on the page. The server sets
// every time (a fight's Fight!, each pick's deadline, the forfeit of a player who left) by the
// database's clock; this page estimates its own clock's offset from the answers (the sample with
// the shortest round trip wins, as NTP does) and starts each fight when the server says so, with
// no Play round. Measurements for the ADR go to `globalThis.__live`.
import type { SeriesView } from '../api/series.ts';
import type { ApiResult } from '../app/api.ts';
import { dueOf, seatsOf } from '../app/online-series.ts';

/** How often a live page asks: its heartbeat, and how soon it hears of a move. */
export const LIVE_POLL_MS = 1_000;
const SAMPLES = 12;

interface Sample {
  readonly rtt: number;
  readonly offset: number;
}

export interface LiveLog {
  readonly fights: { round: number; attempt: number; at: number; scheduled: number }[];
  readonly polls: { sent: number; rtt: number; status: number; version: number | undefined }[];
  readonly picks: { round: number; ball: string; sent: number; answered: number }[];
  readonly seen: { version: number; at: number }[];
  offset: number;
}

export function liveLog(): LiveLog {
  const holder = globalThis as { __live?: LiveLog };
  holder.__live ??= { fights: [], polls: [], picks: [], seen: [], offset: 0 };
  return holder.__live;
}

/** The server's clock as this page best knows it. */
export function createServerClock() {
  const samples: Sample[] = [];
  let offset = 0;
  return {
    sample(sent: number, received: number, serverNow: number | null): void {
      if (serverNow === null) return;
      samples.push({ rtt: received - sent, offset: serverNow - (sent + received) / 2 });
      if (samples.length > SAMPLES) samples.shift();
      const best = samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
      offset = best.offset;
      liveLog().offset = offset;
    },
    now: () => Date.now() + offset,
  };
}

const secs = (ms: number) => String(Math.max(0, Math.ceil(ms / 1000)));

/** The fight of `round`, if the server has scheduled it. */
export const fightOf = (view: SeriesView, round: number) =>
  view.live?.fights.find((fight) => fight.round === round);

/**
 * The line under a live series: the opponent away and the time they have left, a fight about to
 * start, or the pick timer. Undefined when the screens say it all (a fight on, the end).
 */
export function liveNote(
  view: SeriesView,
  now: number,
  watched: number,
  autoPicked: boolean,
): string | undefined {
  const live = view.live;
  if (live === undefined || view.status !== 'open') return undefined;
  const { they } = seatsOf(view);
  if (live.away !== null) {
    return `${they} disconnected · waiting ${secs(live.away.forfeitAt - now)} s…`;
  }
  const next = fightOf(view, watched);
  if (next !== undefined && now < next.at) return `Fight in ${secs(next.at - now)}…`;
  if (watched < view.rounds.length || view.deadline === null) return undefined;
  const deadline = Date.parse(view.deadline);
  const opens = deadline - live.pickSeconds * 1000;
  if (now < opens) return `Next pick in ${secs(opens - now)} s`;
  const left = `${secs(deadline - now)} s`;
  const lead = autoPicked ? 'Time’s up: a random ball was picked for you · ' : '';
  return dueOf(view).includes(view.you)
    ? `${lead}Your pick · ${left}`
    : `${lead}Waiting for ${they} · ${left}`;
}

/** Starts the fight held on its ready card (Fight!), as the player's own tap would. */
export function pressFight(): boolean {
  const button = document.querySelector<HTMLButtonElement>('.ready-fight');
  if (button?.closest('[hidden]') !== null) return false;
  button.click();
  return true;
}

/** What the live driver needs from the series on the page. */
export interface LiveHooks {
  view(): SeriesView | undefined;
  /** The play on screen: its round and attempt, whether it is recorded, and its key. */
  current(): { round: number; attempt: number; key: string; recorded: boolean } | undefined;
  /** The key of the play the arena was last given, and whether it still shows it. */
  shown(): { key: string; ours: boolean };
  /** Puts the current play on the arena (held on its ready card). */
  play(): void;
  /** Moves on to a drawn round's next attempt, as Play again would. */
  next(): void;
  redraw(): void;
}

/**
 * Drives a live series between polls: each fight goes on the arena just before its Fight! and
 * starts at it; a drawn round's replay starts once the draw has been shown; the countdowns tick.
 */
export function createLiveDriver(hooks: LiveHooks) {
  const clock = createServerClock();
  let pressed = '';
  let celebrated = false;
  return {
    clock,
    /** A request timed: its answer's clock sampled, and logged for the measurements. */
    async timed<T extends ApiResult<unknown>>(call: () => Promise<T>): Promise<T> {
      const sent = Date.now();
      const answer = await call();
      const received = Date.now();
      if (answer.ok) clock.sample(sent, received, answer.serverNow ?? null);
      const version = hooks.view()?.version;
      const status = answer.ok ? answer.status : 0;
      liveLog().polls.push({ sent, rtt: received - sent, status, version });
      return answer;
    },
    /** Logs a new version; true when a pick of the player's appeared that this page didn't send. */
    adopted(before: SeriesView | undefined, next: SeriesView, sent: ReadonlySet<number>): boolean {
      if (next.version !== before?.version) {
        liveLog().seen.push({ version: next.version, at: Date.now() });
      }
      const mine = (v: SeriesView | undefined) =>
        v?.picks.filter((p) => p.side === next.you).map((p) => p.round) ?? [];
      const had = mine(before);
      return mine(next).some((round) => !sent.has(round) && !had.includes(round));
    },
    celebrated(done: boolean) {
      celebrated = done;
    },
    tick(): void {
      const view = hooks.view();
      const current = hooks.current();
      if (view?.live === undefined) return;
      hooks.redraw();
      if (current === undefined) return;
      const fight = fightOf(view, current.round);
      if (fight === undefined) return;
      const now = clock.now();
      const shown = hooks.shown();
      if (current.recorded) {
        if (celebrated && shown.ours) hooks.next();
        return;
      }
      if (shown.key !== current.key) {
        if (current.attempt > 0 || now >= fight.at - 2_500) hooks.play();
        return;
      }
      if (pressed === current.key || (current.attempt === 0 && now < fight.at)) return;
      if (pressFight()) {
        pressed = current.key;
        const at = Date.now();
        liveLog().fights.push({
          round: current.round,
          attempt: current.attempt,
          at,
          scheduled: fight.at,
        });
      }
    },
  };
}
