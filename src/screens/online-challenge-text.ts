// A challenge's card in each state, the 16+ confirmation, and sharing a link (ADR 0052).
import type { ChallengeInfo } from '../api/challenges.ts';
import type { ErrorCode } from '../api/errors.ts';
import { GRACE_MS, PICK_SECONDS } from '../api/live.ts';
import { bestOfName, FORMAT_SHORT } from '../ui/series-text.ts';
import { inAppLine, type InAppBrowser } from '../app/in-app-browser.ts';
import type { NoticeContent } from '../ui/notice-content.ts';
import { challengeLine } from './online-text.ts';

export interface CardActions {
  /** The link's token. */
  readonly token: string;
  /** The link itself: the card shows it as text, to read or copy by hand. */
  readonly url: string;
  /** This device has a share sheet (phones): Share is the main button, Copy sits by the link. */
  readonly canShare: boolean;
  /** The link to the clipboard; resolves to what happened, for the button. */
  readonly copy: () => Promise<string>;
  readonly home: () => void;
  /** Build a lineup to accept it. */
  readonly lineup: () => void;
  /** Open the series it started. */
  readonly series: (id: string) => void;
  /** Send a challenge of one's own instead. */
  readonly sendOwn: () => void;
  /** Share (or copy) the sender's own link; resolves to what happened, for the button. */
  readonly share: () => Promise<string>;
  /** The sender stops waiting in a live lobby (ADR 0053). */
  readonly cancel: () => Promise<unknown>;
}

/** Refusals of an accept that the link's own card explains; any other shows its message. */
export const CARD_SAYS: ReadonlySet<ErrorCode> = new Set([
  'not_found',
  'challenge_taken',
  'challenge_expired',
  'own_challenge',
]);

/** The stay rule, as the friend's card's last step and the lobby's line (ADR 0053, 0055). */
const STAY_STEP = `Stay until the end: leaving for ${String(GRACE_MS / 1000)} s loses the match.`;

/** How a live match goes, in three short steps on the friend's card (ADR 0055). */
export function howItGoes(info: Pick<ChallengeInfo, 'format' | 'bestOf'>): readonly string[] {
  return [
    `Build your lineup of ${String(info.bestOf)} without seeing theirs.`,
    info.format === 'showdown'
      ? 'Open together; then the winner shows and the loser answers.'
      : 'Take turns showing a ball; the other answers.',
    STAY_STEP,
  ];
}

/** The facts as chips: "Best of 3", "Reveal", "Live · 30 s a pick". */
export const challengeChips = (info: Pick<ChallengeInfo, 'format' | 'bestOf'>) => [
  bestOfName(info.bestOf),
  FORMAT_SHORT[info.format],
  `Live · ${String(PICK_SECONDS)} s a pick`,
];

/**
 * What a challenge's card says and offers; `undefined` is a link nobody made. `inApp`: the link was
 * opened inside an app's own browser, so a live challenge's card suggests the phone's browser first.
 */
export function cardFor(
  info: ChallengeInfo | undefined,
  actions: CardActions,
  inApp?: InAppBrowser,
): NoticeContent {
  const home = { text: 'Home', onClick: actions.home };
  const own = { text: 'Challenge a friend', onClick: actions.sendOwn };
  if (info === undefined) {
    return {
      title: 'No such challenge',
      body: ['This link doesn’t lead anywhere.'],
      buttons: [own, home],
    };
  }
  const what = challengeLine(info);
  const from = info.from ?? 'A deleted player';
  switch (info.status) {
    case 'open':
      // Live (ADR 0055): who, as a sticker; the facts as chips; how it goes in three steps.
      if (info.live) {
        return {
          title: `${from} challenges you`,
          sticker: { above: 'A challenge from', title: from },
          chips: challengeChips(info),
          body: inApp === undefined ? [] : [inAppLine(inApp)],
          steps: { title: 'How it goes', items: howItGoes(info) },
          buttons: [{ text: 'Build your lineup', onClick: actions.lineup }],
          quiet: { text: 'Not now', onClick: actions.home },
        };
      }
      return {
        title: `${from} challenges you`,
        body: [
          what,
          'Build your lineup without seeing theirs. Then you take turns, up to a day each.',
        ],
        buttons: [{ text: 'Build your lineup', onClick: actions.lineup }, home],
      };
    case 'stopped':
      return info.own
        ? {
            title: 'This link has stopped',
            body: ['You left the lobby, so it stopped waiting. Send your friend a new one.'],
            buttons: [own, home],
          }
        : {
            title: `${from} stopped waiting`,
            body: [what, 'Send them a challenge of your own.'],
            buttons: [own, home],
          };
    case 'yours': {
      const series = info.seriesId;
      if (series !== null) {
        return {
          title: 'Your challenge was accepted',
          body: [what],
          buttons: [
            {
              text: 'Open the series',
              onClick: () => {
                actions.series(series);
              },
            },
            home,
          ],
        };
      }
      if (info.live) {
        // The lobby (ADR 0055): one main button, Share; the link to read in a quiet box with
        // Copy; the stay rule; Cancel as a quiet link.
        const share = actions.canShare;
        return {
          title: 'Your challenge',
          waiting: { title: 'Waiting for your friend', line: `${what} · live` },
          body: [],
          buttons: [shareButton(actions)],
          link: share ? { url: actions.url, copy: actions.copy } : { url: actions.url },
          note: `The match starts the moment they accept. ${STAY_STEP}`,
          quiet: { text: 'Cancel challenge', onClick: actions.cancel },
        };
      }
      return {
        title: 'Send this link to a friend',
        body: [what, 'It works once and lasts 7 days.', actions.url],
        buttons: [shareButton(actions), home],
      };
    }
    case 'accepted': {
      const series = info.seriesId ?? '';
      return {
        title: 'You accepted this challenge',
        body: [what],
        buttons: [
          {
            text: 'Open the series',
            onClick: () => {
              actions.series(series);
            },
          },
          home,
        ],
      };
    }
    case 'taken':
      return {
        title: 'Challenge taken',
        body: ['Someone else accepted this challenge first.'],
        buttons: [own, home],
      };
    default:
      return { title: 'This challenge has expired', body: [what], buttons: [own, home] };
  }
}

function shareButton(actions: CardActions) {
  const label = actions.canShare ? 'Share link' : 'Copy link';
  return { text: label, onClick: actions.share, relabel: true };
}

/**
 * The first online action asks once (ADR 0052 section 6): online play is for players 16 and over,
 * and says what is kept. Confirming makes the guest.
 */
export function adultCard(confirm: () => Promise<unknown>, cancel: () => void): NoticeContent {
  return {
    title: 'Play online',
    body: [
      'Online play is for players 16 and over.',
      'You’ll play as a guest with a made-up name. We keep a random id, your games, and when you ' +
        'confirmed your age: nothing else. “Forget me” in settings deletes it all.',
    ],
    buttons: [
      { text: 'I’m 16 or older', onClick: confirm },
      { text: 'Not now', onClick: cancel },
    ],
  };
}
