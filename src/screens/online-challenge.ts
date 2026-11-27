// Friend challenges on the page (ADR 0052, 0055, 0080; ADR 0089 addendum of 2026-11-27): sending
// one ("Who do you want to play?", or a guest's Play against a friend), the one waiting screen, and
// answering one (the card, with Accept); then both pick lineups together (`?start=`). A waiting
// challenge ends by Cancel challenge, or Back once asked (waiting-back.ts); another tab or screen,
// or the app hidden, keeps it, and the server stops it once its screen is unwatched for a minute
// (LOBBY_SEEN_MS), telling both. The 16+ question comes first,
// once per device, never on load. Every state has a way on (ADR 0027). By turns (ADR 0085), each
// player's lineup goes with the challenge they send or accept, picked here in place.
import { callApi } from '../app/api.ts';
import { inAppBrowserOf } from '../app/in-app-browser.ts';
import { rememberGuest } from '../app/online-device.ts';
import { rememberLobby } from '../app/live-memory.ts';
import {
  writeChallengeParams,
  writeOnlineSeriesParams,
  writeSendParams,
  writeStartParams,
} from '../app/online-url.ts';
import type { Accepted, ChallengeInfo } from '../api/challenges.ts';
import type { BestOf, Format, Lineup } from '../sim/series.ts';
import type { BallDefinition } from '../sim/types.ts';
import { createNotice, type NoticeContent } from '../ui/notice.ts';
import { createLineupStep } from '../ui/series/lineup-step.ts';
import { createSkeleton } from '../ui/skeleton.ts';
import { createChallengeLobby } from './challenge-lobby.ts';
import { createSender } from './challenge-send.ts';
import { unblockThen } from './challenge-unblock.ts';
import { createGuestGate } from './guest-gate.ts';
import { CARD_SAYS, cardFor, waitingOn } from './online-challenge-text.ts';
import type { ChallengeHost, ChallengeScreens } from './online-challenge-types.ts';
import { cardActionsFor } from './challenge-card-actions.ts';
import { createStartLineup } from './start-lineup.ts';
import { createTurnsLineup } from './turns-lineup.ts';
import { createWaitingBack } from './waiting-back.ts';

/** The part of these screens on show. */
type Part = 'notice' | 'lineup' | 'turns' | 'loading';

export function createChallengeScreens(
  roots: {
    readonly notice: HTMLElement;
    readonly lineup: HTMLElement;
    /** The card's layout while it loads on its own (a link opened cold, a reload). */
    readonly loading: HTMLElement;
  },
  balls: readonly BallDefinition[],
  host: ChallengeHost,
): ChallengeScreens {
  let visible = false;
  let info: ChallengeInfo | undefined;
  let token: string | undefined;
  /** Back on the waiting screen asks first. */
  const waitingBack = createWaitingBack();
  /** The waiting screen asking again while the sender waits on it. */
  const lobby = createChallengeLobby(() => loadCard(false));

  const home = () => {
    host.home();
  };
  const back = () => {
    host.back(home);
  };
  // On the waiting screen, Back cancels the challenge, once the player says so; else it stays.
  const noticeBack = () => {
    const waiting = info;
    if (!waitingOn(waiting) || waiting === undefined) {
      back();
      return;
    }
    void waitingBack.ask(waiting.invitee).then((yes) => (yes ? cancel() : undefined));
  };
  const notice = createNotice(roots.notice, noticeBack);
  createSkeleton(roots.loading, 'card', back);
  const lineup = createLineupStep(balls, {
    // Back holds the lineups: the clock runs on, and home leads back to them (ADR 0080).
    onBack: back,
    onLevel: () => undefined,
    onChange: (tray) => {
      start.changed(tray);
    },
    // Lock in is a request: the button shows it is working.
    onDone: (own) => start.lock(own),
  });
  const turnsLineup = createTurnsLineup(balls, {
    show,
    back: (to) => {
      if (to === 'leave' || info === undefined) back();
      else showCard(info, true);
    },
    send: (chosen, own) => sender.sendTurns(chosen, own),
    accept: (own) => accept('replace', own),
  });
  roots.lineup.classList.add('series-setup');
  roots.lineup.replaceChildren(lineup.element, turnsLineup.element);

  const start = createStartLineup(lineup, {
    showLineup: () => {
      show('lineup');
    },
    show: (content, focus) => {
      show('notice', content, focus);
    },
    loading: () => {
      show('loading');
    },
    intoSeries: (id) => intoSeries(id),
    home,
    failed: (answer, retry) => failed(answer, retry),
  });

  /** Shows one part; `focus` false keeps focus where it is (the waiting card, asked again). */
  function show(part: Part, content?: NoticeContent, focus = true): void {
    lobby.stop();
    // "Cancel your challenge?" belongs to the waiting screen alone: anything else shown (the
    // friend accepted and the lineups open, or it stopped) takes it away unanswered.
    if (part !== 'notice' || !waitingOn(info)) waitingBack.close();
    roots.notice.hidden = !visible || part !== 'notice';
    roots.lineup.hidden = !visible || (part !== 'lineup' && part !== 'turns');
    lineup.element.hidden = part !== 'lineup';
    turnsLineup.element.hidden = part !== 'turns';
    roots.loading.hidden = !visible || part !== 'loading';
    if (content !== undefined) notice.show(content, focus);
  }

  /** Into series `id` once it is read, in place of this screen. */
  async function intoSeries(id: string): Promise<void> {
    await host.primeSeries(id);
    host.replaceWith((url) => {
      writeOnlineSeriesParams(url, id);
    });
  }

  /** Into the lineups picked together once read: in place of the card, or moved to (`go`). */
  async function intoStart(id: string, how: 'replace' | 'go' = 'replace'): Promise<void> {
    await start.prime(id);
    const write = (url: URLSearchParams) => {
      writeStartParams(url, id);
    };
    if (how === 'go') host.go(write);
    else host.replaceWith(write);
  }

  // The 16+ question and failures, as notices in this screen's place.
  const { failed, askFirst } = createGuestGate({
    storage: host.storage,
    show: (content) => {
      show('notice', content);
    },
    back,
    home,
    toMatch: (match) => host.toMatch(match),
  });

  // Sending one: "Who do you want to play?" and a guest's Play against a friend (challenge-send.ts).
  const sender = createSender({
    storage: host.storage,
    go: (write) => {
      host.go(write);
    },
    replaceWith: (write) => {
      host.replaceWith(write);
    },
    askFirst: (then) => askFirst(then),
    failed: (answer, retry) => failed(answer, retry),
    sent: (next, card) => {
      token = next;
      info = card;
    },
    intoStart: (id) => intoStart(id, 'go'),
  });

  /**
   * Accepts the link on screen: into the lineups picked together (`how`: from the inbox, go). By
   * turns, its lineup first, then `own` goes with the accept, straight into the series.
   */
  async function accept(how: 'replace' | 'go' = 'replace', own?: Lineup): Promise<void> {
    const current = token;
    if (current === undefined || askFirst(() => accept(how, own))) return;
    if (own === undefined && info?.live === false) {
      turnsLineup.accept(info);
      return;
    }
    const body = own === undefined ? {} : { lineup: own };
    const answer = await callApi<Accepted>('POST', `challenges/${current}/accept`, body);
    if (!answer.ok) {
      if (answer.kind === 'error' && answer.code !== undefined && CARD_SAYS.has(answer.code)) {
        // Taken, expired, the sender's own or gone: the card says so with a way on.
        if (how === 'go') {
          host.go((url) => {
            writeChallengeParams(url, current);
          });
        } else await loadCard();
        return;
      }
      await failed(answer, () => accept(how, own));
      return;
    }
    rememberGuest(host.storage, true);
    const accepted = answer.body;
    if (accepted?.startId != null) await intoStart(accepted.startId, how);
    else if (accepted?.seriesId != null) await intoSeries(accepted.seriesId);
  }

  /** Asks for the card; `focus` false when it already shows (the waiting screen asking again). */
  async function loadCard(focus = true): Promise<void> {
    if (token === undefined) return;
    const asked = token;
    const answer = await callApi<ChallengeInfo>('GET', `challenges/${asked}`);
    // Left meanwhile (another screen, another challenge): this answer is no longer wanted.
    if (asked !== token || !visible) return;
    if (!answer.ok || answer.body === undefined) {
      if (!answer.ok && answer.kind === 'error' && answer.status === 404) {
        show('notice', cardFor(undefined, cardActions()));
      } else if (!answer.ok) await failed(answer, () => loadCard());
      return;
    }
    info = answer.body;
    if (turnsLineup.onCard(info)) return accept();
    // The sender's live challenge was accepted: straight to the lineups (or the match), in place.
    if (info.live && info.own && info.status === 'yours') {
      if (info.seriesId !== null) {
        await intoSeries(info.seriesId);
        return;
      }
      if (info.startId !== null) {
        await intoStart(info.startId);
        return;
      }
    }
    showCard(info, focus);
  }

  /** The card for `card`; the waiting screen asks again soon (each ask keeps it open). */
  function showCard(card: ChallengeInfo, focus: boolean): void {
    const content = cardFor(card, cardActions(), inAppBrowserOf(navigator.userAgent));
    // A guest's link: how to challenge friends by name instead (ADR 0089).
    const after = host.lobbyAfter?.(card);
    show('notice', after === undefined ? content : { ...content, after }, focus);
    if (waitingOn(card) && visible) {
      // Home knows at once that this lobby waits.
      if (token !== undefined) rememberLobby(token, card);
      lobby.next();
      host.lobbyWaits?.();
    }
  }

  /** Cancel challenge: it stops, and the sender goes home (or on, if it was accepted meanwhile). */
  async function cancel(): Promise<void> {
    if (token === undefined) return;
    lobby.stop();
    const answer = await callApi<ChallengeInfo>('POST', `challenges/${token}/cancel`, {});
    const card = answer.ok ? answer.body : undefined;
    if (card?.seriesId != null) await intoSeries(card.seriesId);
    else if (card?.startId != null) await intoStart(card.startId);
    else {
      if (card !== undefined) info = card;
      // Known gone: Play shows at once, never a stale "Back to your lobby" until home asks.
      if (answer.ok) host.lobbyGone?.();
      home();
    }
  }

  const cardActions = () =>
    cardActionsFor(token ?? '', {
      home,
      accept: () => accept(),
      lineups: (id) => intoStart(id, 'go'),
      go: (write) => {
        host.go(write);
      },
      friend: host.friend,
      cancel,
      unblock: (pair) => unblockThen(pair, () => loadCard(), failed),
    });

  /** Another of these screens shows (a new challenge, the lineups, the send screen). */
  function moveOn(): void {
    start.stop();
  }

  return {
    setVisible(next) {
      // Leaving these screens forgets a friend picked for by turns; a waiting challenge stays.
      if (!next && visible) sender.forget();
      visible = next;
      if (!next) {
        waitingBack.close();
        show('notice');
        start.stop();
      }
    },
    resumed() {
      // Back from a share sheet or another app: the waiting screen asks at once.
      if (visible && lobby.waiting()) {
        lobby.stop();
        void loadCard(false);
      }
    },
    showChallenge(next) {
      moveOn();
      if (token !== next) info = undefined;
      token = next;
      // Read just before (the waiting screen after a send): shown at once, and asked again as the
      // waiting screen does. Else the card's layout until it comes (ADR 0054).
      if (info === undefined) {
        show('loading');
        void loadCard();
      } else {
        showCard(info, true);
        // A card seen before is asked again (it may have been taken); a lobby asks on its own.
        if (!lobby.waiting()) void loadCard(false);
      }
    },
    showStart(id) {
      moveOn();
      start.open(id);
    },
    rematchShown: () => start.rematchOf(),
    openInvite(next, live = true) {
      moveOn();
      token = next;
      info = undefined;
      if (live) return accept('go');
      // By turns (ADR 0085): its card's screen, which opens the lineup once the card is read.
      turnsLineup.openOnCard();
      host.go((url) => {
        writeChallengeParams(url, next);
      });
      return Promise.resolve();
    },
    sendNow: (setup, friend, moving, wanted) => sender.sendNow(setup, friend, moving, wanted),
    turnsWith(friend, setup) {
      sender.turnsWith(friend);
      host.go((url) => {
        writeSendParams(url, setup.format, setup.bestOf);
      });
    },
    async playFriend(setup) {
      moveOn();
      token = undefined;
      await sender.playFriend(setup);
    },
    showSend(format: Format, bestOf: BestOf) {
      moveOn();
      token = undefined;
      // Play's own step (the 16+ question, or a failure), or a lineup by turns to send.
      const left = sender.takeLeft();
      if (left !== undefined) {
        left();
        return;
      }
      if (sender.turnsFirst()) {
        turnsLineup.send({ format, bestOf, level: '', turns: true });
        return;
      }
      // An old link to the vs Friend setup (ADR 0055): there is none now; the one path instead.
      host.friendPath({ format, bestOf });
    },
  };
}
