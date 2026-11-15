// A challenge's card in each state, the 16+ confirmation, and sharing a link (ADR 0052).
import type { ChallengeInfo } from '../api/challenges.ts';
import { PICK_SECONDS } from '../api/live.ts';
import type { NoticeContent } from '../ui/notice.ts';
import { STAY_LINE } from './live-text.ts';
import { challengeLine } from './online-text.ts';

export interface CardActions {
  /** The link's token: the card shows the link as text, to copy by hand. */
  readonly token: string;
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

/** What a live match is, said on both players' cards before it starts (ADR 0053). */
const LIVE_LINE = `You play live, together: ${String(PICK_SECONDS)} s a pick.`;

/** The link to a challenge, on this site. */
export const challengeUrl = (token: string): string =>
  `${window.location.origin}/?challenge=${encodeURIComponent(token)}`;

/** The system share sheet where there is one (phones), else the clipboard. */
export async function shareLink(token: string): Promise<string> {
  const url = challengeUrl(token);
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: 'BallBattle challenge', url });
      return 'Shared';
    }
    await navigator.clipboard.writeText(url);
    return 'Link copied';
  } catch {
    return 'Copy the link above';
  }
}

/** What a challenge's card says and offers; `undefined` is a link nobody made. */
export function cardFor(info: ChallengeInfo | undefined, actions: CardActions): NoticeContent {
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
      return {
        title: `${from} challenges you`,
        body: info.live
          ? [what, `Build your lineup without seeing theirs. ${LIVE_LINE}`, STAY_LINE]
          : [
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
        return {
          title: 'Waiting for your friend…',
          body: [
            what,
            'Send them this link: the match starts as soon as they accept.',
            STAY_LINE,
            challengeUrl(actions.token),
          ],
          buttons: [shareButton(actions), { text: 'Cancel', onClick: actions.cancel }],
        };
      }
      return {
        title: 'Send this link to a friend',
        body: [what, 'It works once and lasts 7 days.', challengeUrl(actions.token)],
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
  const label = typeof navigator.share === 'function' ? 'Share link' : 'Copy link';
  return {
    text: label,
    onClick: (event?: Event) => {
      const button = event?.currentTarget;
      void actions.share().then((done) => {
        if (button instanceof HTMLElement) button.textContent = done;
      });
    },
  };
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
