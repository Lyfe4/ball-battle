-- The inbox (ADR 0079, PR (d)), expand only: when an account was last active, for its friends'
-- status, and the friend a live challenge was sent to. Nothing reads them until accounts are on.
--
-- `active_at` is written by the account's own requests at most every 30 s (session.ts): online is
-- active within 75 s. Guests never write it.
alter table game.profiles add column active_at timestamptz;

comment on column game.profiles.active_at is
  'When this account last made a request (at most every 30 s): its friends see it online.';

-- A challenge sent to a friend (from the Friends section) names them: it reaches their inbox while
-- the sender's lobby waits. `invitee_declined_at` is their No thanks; the link still works for
-- anyone it was shared with. A deleted invitee leaves the link as a plain one.
alter table game.challenges
  add column invitee uuid references game.profiles (user_id) on delete set null,
  add column invitee_declined_at timestamptz;

create index challenges_invitee_waiting on game.challenges (invitee)
  where invitee is not null and live and series_id is null and cancelled_at is null;
