-- One outgoing challenge per player (ADR 0089 addendum of 2026-11-27), expand only.
--
-- Sending a challenge calls off the sender's older ones still waiting, in the same transaction
-- (src/server/challenges.ts). `superseded_by` names the challenge that took an old one's place, so
-- the old link's own card can say "You sent a new challenge" rather than "You left the lobby". It
-- is written together with `cancelled_at`, whose change already pokes the old challenge's friend
-- (`poke_challenge_changed`, 20261124120000_poke.sql): their banner or row goes at once.
alter table game.challenges
  add column superseded_by uuid references game.challenges (id) on delete set null;

comment on column game.challenges.superseded_by is
  'The newer challenge from the same sender that called this one off (one outgoing at a time).';

-- What a send calls off: the sender's challenges nobody has accepted or called off yet.
create index challenges_creator_open on game.challenges (creator)
  where series_id is null and start_id is null and cancelled_at is null;
