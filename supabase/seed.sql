-- Local development and CI only (`supabase start`, `supabase db reset`): the API's login role gets
-- a known password. Staging and production set theirs once in the dashboard's SQL editor.
alter role game_api_v2 with password 'game_api_local';

-- Local development and CI only: the Send Email hook (ADR 0082) delivers codes to Mailpit, the
-- local mail catcher, by its name on the stack's Docker network. Hosted projects set their own row
-- (Resend, its key in Vault) by hand.
insert into game.mail_relay (kind, url, sender_name, sender_email)
values ('mailpit', 'http://supabase_inbucket_ballbattle:8025/api/v1/send', 'BallBattle', 'codes@ballbattle.local');
