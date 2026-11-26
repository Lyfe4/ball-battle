// What "Who do you want to play?" says (ADR 0089, B1): its groups, the line under them, the way to
// anyone with a link, the empty state, the Play box with a friend picked, and the lobby's friends.
// Pure, so every state is tested without a DOM. Accounts code: a build without accounts holds none.
import type { FriendSetup } from '../app/modes.ts';
import { setupLine } from '../ui/modes-text.ts';

export const WHO_TITLE = 'Who do you want to play?';
/** How many friends not online show before "Show all". */
export const OTHERS_SHOWN = 3;
export const ANYONE = 'Anyone, with a link';
export const ANYONE_FIRST = 'Send a link to anyone';
export const NO_FRIENDS = 'No friends yet. Add one by username or code, or send anyone a link.';
export const ADD_FRIEND = 'Add a friend';
export const OR_A_FRIEND = 'Or challenge a friend';
export const SIGN_IN = 'Sign in';
export const SIGN_IN_LINE = 'to challenge friends in the game.';
/** What to play's row under Against a friend: the sheet that picks them. */
export const CHOOSE_WHO = 'Choose who to play';

/** The online group's title: "Online · 2". */
export const onlineTitle = (count: number): string => `Online · ${String(count)}`;

/** The rest's title: "Not online" under the online ones, else "Friends · 3". */
export function othersTitle(anyOnline: boolean, count: number): string {
  return anyOnline ? 'Not online' : `Friends · ${String(count)}`;
}

/** Under the online group: what Challenge starts, on the box's rules. */
export function liveLine(setup: FriendSetup): string {
  return `Live now, ${setupLine(setup.format, setup.bestOf)}.`;
}

/** With nobody online: what is left, by turns where the build has it. */
export function noneOnlineLine(turns: boolean): string {
  return turns
    ? 'None of your friends is online. Play by turns: they play when they’re back.'
    : 'None of your friends is online right now.';
}

export const showAll = (count: number): string => `Show all ${String(count)} friends`;

/** The Play box with a friend picked: who, then how and the rules. */
export interface FriendBox {
  readonly who: string;
  readonly rules: string;
  /** Both lines and what the box opens, for its name. */
  readonly spoken: string;
  /** Play's name: what it starts. */
  readonly play: string;
  /** Their initial, on the box's disc. */
  readonly initial: string;
}

export function friendBox(name: string, turns: boolean, setup: FriendSetup): FriendBox {
  const how = turns ? 'By turns' : 'Live';
  const line = setupLine(setup.format, setup.bestOf);
  const rules = `${how} · ${line}`;
  return {
    who: `vs ${name}`,
    rules,
    spoken: `vs ${name}, ${rules}: what to play`,
    play: turns ? `Play ${name} by turns, ${line}` : `Challenge ${name} live, ${line}`,
    initial: name.slice(0, 1),
  };
}
