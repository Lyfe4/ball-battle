// What a username may be (ADR 0079), checked on the server only: the page shows the server's
// words. ASCII only, said plainly; then our own blocklist (username-words.ts), read after folding
// the spellings people use to get round one: any case, digits for letters ("sh1t", "a55"), `_`
// between letters, a letter held down ("fuuuck"), and a capital starting a new word ("BigAss").
import { BLOCKED_ANYWHERE, BLOCKED_WHOLE } from './username-words.ts';

/** `USERNAME_RULE` (src/api/accounts.ts), and the database's own check on the column. */
const FORMAT = /^[A-Za-z0-9_]{3,15}$/;

/** Digits read as the letters they stand for; 1 is read both as i and as l. */
const DIGIT_AS: Readonly<Record<string, readonly string[]>> = {
  '0': ['o'],
  '1': ['i', 'l'],
  '3': ['e'],
  '4': ['a'],
  '5': ['s'],
  '6': ['g'],
  '7': ['t'],
  '8': ['b'],
  '9': ['g'],
};

/** Every reading of `text` (lower case, no `_`) with its digits as letters. */
function readings(text: string): string[] {
  let out = [''];
  for (const character of text) {
    const as = DIGIT_AS[character] ?? [character];
    out = out.flatMap((start) => as.map((letter) => start + letter));
  }
  return out;
}

/** "fuuuck" as "fuck": every run of one letter as one. */
const squeezed = (text: string): string => text.replace(/(.)\1+/g, '$1');

/** A letter held down: three or more in a row. Ordinary doubles ("boot", "basket") aren't read so. */
const held = (text: string): boolean => /(.)\1\1/.test(text);

/** The words held down, where they stay long enough not to hide in others ("kkk" as "k" would). */
const BLOCKED_SQUEEZED = BLOCKED_ANYWHERE.map(squeezed).filter((word) => word.length >= 4);

/** Holds a blocked word anywhere, in any reading, letters held down or not. */
function blockedAnywhere(name: string): boolean {
  return readings(name.toLowerCase().replaceAll('_', '')).some((reading) => {
    const short = squeezed(reading);
    return (
      BLOCKED_ANYWHERE.some((word) => reading.includes(word)) ||
      (held(reading) && BLOCKED_SQUEEZED.some((word) => short.includes(word)))
    );
  });
}

/** The words of a name: split at `_` and before a capital that follows a lower-case letter. */
const partsOf = (name: string): string[] =>
  name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split('_')
    .filter((part) => part !== '');

/**
 * A part that is a blocked word: as it is, without the digits around it ("ass99"), or with a
 * letter held down ("asss", never a shorter part such as "as", nor "mood" as "mod").
 */
function blockedPart(part: string): boolean {
  const bare = part.replace(/^\d+|\d+$/g, '');
  return [part, bare].some((candidate) =>
    readings(candidate).some((reading) =>
      BLOCKED_WHOLE.some(
        (word) =>
          reading === word ||
          (held(reading) && reading.length >= word.length && squeezed(reading) === squeezed(word)),
      ),
    ),
  );
}

/** Every guest is "Player 1234": no name may start as one does, in any reading. */
const posesAsGuest = (name: string): boolean =>
  readings(name.toLowerCase().replaceAll('_', '')).some((reading) =>
    squeezed(reading).startsWith('player'),
  );

export type UsernameProblem = 'format' | 'blocked';

/** Why `name` can't be a username, or undefined when it can. */
export function usernameProblem(name: string): UsernameProblem | undefined {
  if (!FORMAT.test(name)) return 'format';
  if (posesAsGuest(name) || blockedAnywhere(name) || partsOf(name).some(blockedPart)) {
    return 'blocked';
  }
  return undefined;
}
