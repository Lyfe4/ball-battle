-- The API's queries end after 8 seconds (audit 2026-11-21). Without a limit, a query stuck behind
-- a lock or a slow pooler ran until Netlify ended the function, while the player's page gave up at
-- 15 s; now the query is cancelled, the request answers 500 in time for the page to say so with Try
-- again, and the connection is free for the next request. Eight seconds is far beyond any query the
-- game makes (each is milliseconds) and inside a function's time limit. A role's setting applies
-- at each new login, so pooled connections pick it up as they reconnect. It is set on the login
-- role: a setting on game_api, which it inherits privileges from, would not apply to it.
alter role game_api_v2 set statement_timeout = '8s';
