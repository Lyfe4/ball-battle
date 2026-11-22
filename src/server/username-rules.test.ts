// What a username may be (ADR 0079): the format said plainly, and the blocklist read through the
// spellings used to get round it, without refusing ordinary words that hold a short one.
import { describe, expect, it } from 'vitest';
import { usernameProblem } from './username-rules.ts';

describe('a username’s format', () => {
  it.each(['sam', 'Sam_99', 'abc', 'x_y_z_123456789', '___', 'ALLCAPS'])('takes %s', (name) => {
    expect(usernameProblem(name)).toBeUndefined();
  });

  it.each([
    ['too short', 'ab'],
    ['too long', 'a234567890123456'],
    ['a space', 'big sam'],
    ['an accent', 'josé'],
    ['another script', 'игрок'],
    ['an emoji', 'sam🙂'],
    ['punctuation', 'sam.99'],
    ['a dash', 'sam-99'],
    ['nothing', ''],
  ])('refuses %s', (_why, name) => {
    expect(usernameProblem(name)).toBe('format');
  });
});

describe('the blocklist', () => {
  it.each([
    ['a word as it is', 'fuck'],
    ['inside a name', 'xXfuckXx'],
    ['in capitals', 'SHIT'],
    ['digits for letters', 'sh1t'],
    ['1 read as l', 'bo11ocks'],
    ['zero for o', 'p0rn'],
    ['several digits', 'b1tch3s'],
    ['underscores between letters', 'f_u_c_k'],
    ['a letter held down', 'fuuuuck'],
    ['held down and in digits', 'sh11111t'],
    ['a short word as a whole part', 'big_ass'],
    ['a short word starting a capital', 'BigAss'],
    ['a short word in digits', 'a55'],
    ['a short word with a number after', 'ass99'],
    ['a short word held down', 'asss'],
    ['posing as staff', 'BallBattleAdmin'],
    ['posing as a guest', 'Player1234'],
    ['posing as a deleted player', 'deleted_player'],
    ['a moderator in digits', 'm0derator'],
    // Anatomy and slurs, as Calvin found "bumhole" accepted on staging.
    ['anatomy in one word', 'bumhole'],
    ['anatomy in capitals', 'BumHole'],
    ['anatomy split', 'bum_hole'],
    ['anatomy in digits', 'bumh0le'],
    ['a short word as a part', 'Big_Bum'],
    ['the open list', 'butthole'],
    ['the open list, folded', 'Ball_Sack'],
    ['a compound', 'nutsack99'],
    ['a compound of a short word', 'DickHead'],
    ['a slur from the open list', 'wetback'],
    ['a slur as a part', 'paki_7'],
    ['a slur held down', 'raggghead'],
    // Names that pass for a guest or the game.
    ['anything starting player', 'PlayerOne'],
    ['player in digits', 'P1ayer_7'],
    ['a bot', 'Bot'],
    ['a bot as a part', 'NormalBot'],
    ['a bot in digits', 'b0t_99'],
    ['admin', 'Admin'],
    ['mod', 'MOD'],
    ['support', 'support'],
    ['system', 'System_1'],
    ['the game', 'BALLBATTLE'],
  ])('refuses %s (%s)', (_why, name) => {
    expect(usernameProblem(name)).toBe('blocked');
  });

  it.each([
    'glass',
    'classic',
    'peacock',
    'grape',
    'therapist',
    'torpedo',
    'Dickens',
    'cocktail',
    'title',
    'as_if',
    'assassin_no',
    'homer',
    'moderate',
    'Sussex',
    'Matsumoto',
    'happy_fish',
    'sam_99',
    'nightowl',
    'Kirk',
    // Hold a word from the open list inside another.
    'basement',
    'specialist',
    'Montenegro',
    'bumblebee',
    'Twinkle',
    'domestic',
    'basket',
    'considerate',
    'boot_camp',
    'moody',
    'robot_wars',
    'replay_fan',
  ])('takes %s, which only holds a short word inside another', (name) => {
    expect(usernameProblem(name)).toBeUndefined();
  });
});
