// Friend challenges on the page (ADR 0052, 0055, 0080): sending one (the Play tab's Play against a
// friend, or the vs Friend setup's Send challenge, then the lobby with the link to share) and
// answering one (the card that says who sent it, with Accept). Once accepted, both players pick
// their lineups together on one screen (`?start=`, start-lineup.ts), the same screen a rematch uses.
// The guest is made here after the 16+ confirmation, asked once per device at the start of either
// flow (Play against a friend or opening the vs Friend setup, or Accept on a friend's card); never on
// load. Every state has a way on (ADR 0027). By turns (ADR 0085), each player's lineup goes with
// the challenge they send or accept, picked here in place, Back returning to the setup or the card.
import { callApi } from '../app/api.ts';
import { inAppBrowserOf } from '../app/in-app-browser.ts';
import { rememberGuest } from '../app/online-device.ts';
import {
  writeChallengeParams,
  writeOnlineSeriesParams,
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
import { createFriendSetup } from './friend-setup.ts';
import { createGuestGate } from './guest-gate.ts';
import { CARD_SAYS, cardFor } from './online-challenge-text.ts';
import type { ChallengeHost, ChallengeScreens } from './online-challenge-types.ts';
import { challengeUrl, copyLink, shareLink } from './online-share.ts';
import { createStartLineup } from './start-lineup.ts';
import { createTurnsLineup } from './turns-lineup.ts';

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
  /** The lobby asking again while the sender waits in it. */
  const lobby = createChallengeLobby(() => loadCard(false));

  const home = () => {
    host.home();
  };
  const back = () => {
    host.back(home);
  };
  const notice = createNotice(roots.notice, back);
  createSkeleton(roots.loading, 'card', back);
  const setup = createFriendSetup({
    back,
    rewrite: (write) => {
      host.rewrite(write);
    },
    send: (chosen) => sender.send(chosen),
  });
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
    show: () => {
      show('turns');
    },
    back: (toSetup) => {
      if (toSetup) show('setup');
      else if (info === undefined) back();
      else showCard(info, true);
    },
    send: (chosen, own) => sender.sendTurns(chosen, own),
    accept: (own) => accept('replace', own),
  });
  roots.lineup.classList.add('series-setup');
  roots.lineup.replaceChildren(setup.element, lineup.element, turnsLineup.element);

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
    failed: (answer, retry) => {
      failed(answer, retry);
    },
  });

  /** Shows one part; `focus` false keeps focus where it is (the lobby's card, asked again). */
  function show(
    part: 'notice' | 'setup' | 'lineup' | 'turns' | 'loading',
    content?: NoticeContent,
    focus = true,
  ): void {
    lobby.stop();
    roots.notice.hidden = !visible || part !== 'notice';
    roots.lineup.hidden = !visible || (part !== 'lineup' && part !== 'setup' && part !== 'turns');
    setup.element.hidden = part !== 'setup';
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

  // Sending one: the setup's Send challenge and Play against a friend (challenge-send.ts).
  const sender = createSender({
    storage: host.storage,
    go: (write) => {
      host.go(write);
    },
    replaceWith: (write) => {
      host.replaceWith(write);
    },
    askFirst: (then) => askFirst(then),
    failed: (answer, retry) => {
      failed(answer, retry);
    },
    sent: (next, card) => {
      token = next;
      info = card;
    },
    lineupFirst: (chosen) => {
      turnsLineup.send(chosen);
    },
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
      failed(answer, () => accept(how, own));
      return;
    }
    rememberGuest(host.storage, true);
    const accepted = answer.body;
    if (accepted?.startId != null) await intoStart(accepted.startId, how);
    else if (accepted?.seriesId != null) await intoSeries(accepted.seriesId);
  }

  /** Asks for the card; `focus` false when it already shows (the lobby asking again). */
  async function loadCard(focus = true): Promise<void> {
    if (token === undefined) return;
    const answer = await callApi<ChallengeInfo>('GET', `challenges/${token}`);
    if (!answer.ok || answer.body === undefined) {
      if (!answer.ok && answer.kind === 'error' && answer.status === 404) {
        show('notice', cardFor(undefined, cardActions()));
      } else if (!answer.ok) failed(answer, () => loadCard());
      return;
    }
    info = answer.body;
    if (turnsLineup.onCard(info)) return accept();
    // The sender's live link was accepted: straight to the lineups (or the match), in its place.
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

  /** The card for `card`; a waiting lobby asks again soon (each ask keeps the link open). */
  function showCard(card: ChallengeInfo, focus: boolean): void {
    show('notice', cardFor(card, cardActions(), inAppBrowserOf(navigator.userAgent)), focus);
    if (card.live && card.status === 'yours' && visible) {
      lobby.next();
      host.lobbyWaits?.();
    }
  }

  /** The sender stops waiting: the link stops, and they go home (or on, if it was accepted). */
  async function cancel(): Promise<void> {
    if (token === undefined) return;
    lobby.stop();
    const answer = await callApi<ChallengeInfo>('POST', `challenges/${token}/cancel`, {});
    const card = answer.ok ? answer.body : undefined;
    if (card?.seriesId != null) await intoSeries(card.seriesId);
    else if (card?.startId != null) await intoStart(card.startId);
    else host.home();
  }

  function cardActions() {
    const current = token ?? '';
    return {
      token: current,
      home,
      // The 16+ question comes first, on a device that hasn't answered it (askFirst).
      accept: () => accept(),
      lineups: (id: string) => intoStart(id, 'go'),
      series: (id: string) => {
        host.go((url) => {
          writeOnlineSeriesParams(url, id);
        });
      },
      sendOwn: () => {
        host.friend();
      },
      share: () => shareLink(current),
      url: challengeUrl(current),
      canShare: typeof navigator.share === 'function',
      copy: () => copyLink(current),
      cancel: () => cancel(),
    };
  }

  return {
    setVisible(next) {
      // Leaving these screens forgets a friend being challenged: a later challenge is a link.
      if (!next && visible) sender.invite(undefined);
      visible = next;
      if (!next) {
        show('notice');
        start.stop();
      }
    },
    resumed() {
      // Back from a share sheet or another app: the lobby asks at once.
      if (visible && lobby.waiting()) {
        lobby.stop();
        void loadCard(false);
      }
    },
    showChallenge(next) {
      start.stop();
      if (token !== next) info = undefined;
      token = next;
      // Read just before (the lobby after Send challenge): shown at once, and asked again as the
      // lobby does. Else the card's layout until it comes (ADR 0054).
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
      start.open(id);
    },
    rematchShown: () => start.rematchOf(),
    openInvite(next, live = true) {
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
    challengeFriend(friend, turns) {
      sender.invite(friend, turns);
      host.friend();
    },
    async playFriend(setup) {
      token = undefined;
      start.stop();
      await sender.playFriend(setup);
    },
    showSend(format: Format, bestOf: BestOf) {
      token = undefined;
      start.stop();
      // Play against a friend's own step (the 16+ question, or a failure), never its rules step.
      const left = sender.takeLeft();
      if (left !== undefined) {
        left();
        return;
      }
      // The start of the vs Friend flow: the 16+ question first, on a device that hasn't answered.
      const open = () => {
        show('setup');
        setup.open({ format, bestOf, level: '' });
        // Take turns from a friend's sheet: the setup's own By turns path, straight to its lineup.
        if (sender.turnsFirst()) void sender.send({ format, bestOf, level: '', turns: true });
      };
      if (!askFirst(open)) open();
    },
  };
}
