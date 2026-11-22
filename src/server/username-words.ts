// The words a username may not hold (ADR 0079): an open list (LDNOOBW's English list, CC BY 4.0,
// username-words-ldnoobw.ts) and our own, no dependency. Each is read as `username-rules.ts` folds
// a name (lower case, letters only, digits read as letters). The owner can clear a name that slips
// through in SQL (`update game.profiles set username = null where ...`).
import { LDNOOBW_EN } from './username-words-ldnoobw.ts';

/** The open list's entries as a name is folded: letters only ("ball sack" as "ballsack"). */
const OPEN_LIST = LDNOOBW_EN.split(/[,\n]/)
  .map((entry) => entry.toLowerCase().replace(/[^a-z]/g, ''))
  .filter((word) => word.length >= 3);

/**
 * The open list's words found inside ordinary ones, read only as a whole part of a name: "therapist",
 * "basement", "specialist", "Montenegro", "bisexual", "twinkle" and "domestic" stay fine.
 */
const OPEN_WHOLE_ONLY: readonly string[] = [
  'rapist',
  'semen',
  'cialis',
  'negro',
  'sexual',
  'sexuality',
  'twink',
  'dommes',
];

/** From the open list: its words of 5 letters or more, anywhere; shorter ones as a whole part. */
const fromOpen = (anywhere: boolean) =>
  OPEN_LIST.filter((word) => (word.length >= 5 && !OPEN_WHOLE_ONLY.includes(word)) === anywhere);

/**
 * Found anywhere in a name: long or unusual enough that an innocent word rarely holds them
 * ("scunthorpe" is refused; such a player picks another name).
 */
export const BLOCKED_ANYWHERE: readonly string[] = [
  'fuck',
  'fvck',
  'shit',
  'cunt',
  'nigg',
  'niga',
  'nigr',
  'faggot',
  'fagot',
  'bitch',
  'biatch',
  'whore',
  'slut',
  'pussy',
  'penis',
  'vagina',
  'porn',
  'wanker',
  'twat',
  'bollock',
  'motherf',
  'dildo',
  'blowjob',
  'handjob',
  'jizz',
  'cumshot',
  'hitler',
  'nazi',
  'heilh',
  'kkk',
  'retard',
  'tranny',
  'paedo',
  'molest',
  'killyourself',
  // Anatomy and its compounds, where a short word is hidden in a longer one.
  'bumhole',
  'bumhol',
  'bumface',
  'buttplug',
  'buttface',
  'ballsack',
  'ballsac',
  'nutsack',
  'scrotum',
  'testicle',
  'foreskin',
  'bellend',
  'knobhead',
  'knobend',
  'dickhead',
  'dickface',
  'cockhead',
  'cocksuck',
  'asswipe',
  'asshat',
  'assface',
  'arsewipe',
  'titwank',
  'golliwog',
  // Posing as the game or its staff.
  'admin',
  'moderator',
  'ballbattle',
  'battleball',
  'official',
  ...fromOpen(true),
];

/**
 * Refused only as a whole part of a name (split at `_` and at a capital): too short to search
 * inside other words ("glass", "peacock", "grape", "therapist", "torpedo" stay fine).
 */
export const BLOCKED_WHOLE: readonly string[] = [
  'ass',
  'arse',
  'cock',
  'dick',
  'fag',
  'cum',
  'sex',
  'rape',
  'tit',
  'tits',
  'boob',
  'boobs',
  'spic',
  'kike',
  'chink',
  'gook',
  'coon',
  'homo',
  'dyke',
  'nonce',
  'fuk',
  'pedo',
  'rapist',
  'kys',
  'wank',
  'bum',
  'bums',
  'butt',
  'anus',
  'anal',
  'knob',
  'spaz',
  'paki',
  'bot',
  'mod',
  'staff',
  'support',
  'system',
  'root',
  'owner',
  'deleted',
  'player',
  'guest',
  'null',
  'undefined',
  ...fromOpen(false),
];
