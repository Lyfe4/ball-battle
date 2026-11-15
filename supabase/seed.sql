-- Local development and CI only (`supabase start`, `supabase db reset`): the API's login role gets
-- a known password. Staging and production set theirs once in the dashboard's SQL editor.
alter role game_api_v2 with password 'game_api_local';
