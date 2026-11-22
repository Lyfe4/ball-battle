-- Accounts (ADR 0079): a player who signed in with Google or an email code. Rules read this
-- column, never a token's `is_anonymous` claim (a copy of a guest's old token stays valid for up
-- to an hour after it is linked). Null is a guest. Expand only: nothing reads it until the
-- accounts switch is on.
alter table game.profiles add column account_at timestamptz;

comment on column game.profiles.account_at is
  'When this player became an account (signed in with Google or an email code); null for a guest.';
