-- Usernames (ADR 0079, PR (b)): an account's public name, shown to opponents in place of its
-- generated "Player 1234". Letters a-z (either case, kept as typed), digits and _, 3 to 15
-- characters; unique ignoring case. Guests never have one. `username_set_at` is when it was last
-- chosen: one change per 30 days, read against the database's now(). Expand only: nothing reads
-- either column until the accounts switch is on, and a null shows the generated name as before.
alter table game.profiles
  add column username text check (username ~ '^[A-Za-z0-9_]{3,15}$'),
  add column username_set_at timestamptz;

create unique index profiles_username_key on game.profiles (lower(username));

comment on column game.profiles.username is
  'An account''s chosen public name (ADR 0079); unique ignoring case; null shows display_name.';
comment on column game.profiles.username_set_at is
  'When the username was last chosen: one change per 30 days.';
