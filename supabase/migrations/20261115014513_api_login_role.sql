-- The API's login role, fresh (ADR 0052, "As built (staging): a fresh login role"). Supabase's
-- pooler (Supavisor) caches a role's credentials; on staging some of its nodes kept `game_api`'s
-- from before its password was set and refused a few connections in twenty with 28P01, which
-- Supabase's guide fixes by logging in as a role the pooler has never seen. `game_api_v2` is that
-- role: a member of `game_api`, inheriting every grant, so the privileges stay in one place and a
-- later migration grants to `game_api` as before. BYPASSRLS is an attribute, not inherited, so it
-- is set here too. Its password is set per environment outside migrations, before anything
-- connects as it (supabase/seed.sql locally; the dashboard's SQL editor on staging and production).
create role game_api_v2 with login inherit bypassrls in role game_api;
