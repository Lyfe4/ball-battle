-- Local development and CI only (`supabase start`, `supabase db reset`): the API's role gets a
-- known password. Staging and production set theirs once in the dashboard's SQL editor.
alter role game_api with password 'game_api_local';
