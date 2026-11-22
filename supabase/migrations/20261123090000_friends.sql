-- Friends (ADR 0079, PR (c)), expand only: a friend code on an account's profile and one row per
-- pair of accounts. Nothing reads either until the accounts switch is on.
--
-- A friend code is 8 Crockford base32 characters (no I, L, O or U), made the first time an account
-- opens its friends; unique, so two accounts can never share one.
alter table game.profiles add column friend_code text unique check (friend_code ~ '^[0-9A-HJKMNP-TV-Z]{8}$');

comment on column game.profiles.friend_code is
  'An account''s friend code (ADR 0079): 8 Crockford base32 characters, made on first use.';

-- One row per pair (low < high, so a double tap or two requests at once meet on one row). A
-- request is `requested_by` with `accepted_at` null; accepted, they are friends. A declined request
-- keeps its row for 30 days (`declined_at`) so the sender can't send it again, then the sweep drops
-- it; to the sender it still reads as sent. Removing a friend or cancelling a request deletes the
-- row, except a declined one the sender cancels: it stays, hidden from them (`withdrawn_at`), so
-- cancelling can't clear the way to send it again. `id` names the row to the page, so no player's user id leaves the server.
create table game.friendships (
  low uuid not null references game.profiles (user_id) on delete cascade,
  high uuid not null references game.profiles (user_id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  requested_by uuid not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  withdrawn_at timestamptz,
  primary key (low, high),
  check (low < high),
  check (requested_by in (low, high)),
  check (accepted_at is null or declined_at is null),
  check (withdrawn_at is null or declined_at is not null)
);

create index friendships_high on game.friendships (high);

comment on table game.friendships is
  'Friends and friend requests between accounts (ADR 0079): one row per pair.';

alter table game.friendships enable row level security;
grant select, insert, update, delete on game.friendships to game_api;
revoke all on game.friendships from anon, authenticated;
