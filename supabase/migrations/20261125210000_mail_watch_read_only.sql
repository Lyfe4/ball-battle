-- The daily check counts code emails with `game.mail_outcomes` (ADR 0082, the mail watch), but it
-- reads through `supabase db query --read-only`, which runs as `supabase_read_only_user`.
-- 20261124190000_mail_watch.sql revoked the function from public, and pg_read_all_data reads tables,
-- not functions, so the check failed: "permission denied for function mail_outcomes". Expand only.
--
-- Only the counting function: it is stable and reads (the role's transactions are read-only too).
-- Never `game.mail_watch()`, which copies answers into `game.mail_sends`.
grant execute on function game.mail_outcomes(integer) to supabase_read_only_user;
