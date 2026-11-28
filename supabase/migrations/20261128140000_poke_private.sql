-- Pokes go out on private channels that browsers may only listen on (2026-11-28 audit, ADR 0092),
-- expand only.
--
-- On a public channel any client that knows a topic can also broadcast to it, by socket or by
-- Realtime's REST endpoint with the browser key: a stranger who learned a player's topic could make
-- their page read over and over. A private channel asks `realtime.messages`' policies instead, as
-- the joining role: the page joins with the browser key alone, which is `anon` (no sign-in token in
-- the page, ADR 0052), and the policy below lets `anon` and `authenticated` receive broadcasts on a
-- poke topic and nothing else. With no insert policy, no client can send on any private channel;
-- `realtime.send` (the triggers, as the table's owner) still can. A public channel of the same name
-- is a different channel, so a send there never reaches the page.
--
-- The policy reads `realtime.topic()`, which only Realtime sets while it authorises a join: a
-- direct select (none is exposed: `realtime` isn't an API schema) sees no rows. Listening still
-- needs the topic, 122 random bits handed only to its own player (20261124120000_poke.sql).

create policy poke_listen on realtime.messages
  for select to anon, authenticated
  using (realtime.messages.extension = 'broadcast' and realtime.topic() like 'p:%');

-- The same poke as before, sent private.
create or replace function game.poke(player uuid, event text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  key text;
begin
  if player is null then
    return;
  end if;
  if not exists (select 1 from game.flags where name = 'poke' and enabled) then
    return;
  end if;
  select poke_key into key from game.profiles where user_id = player;
  if key is null then
    return;
  end if;
  begin
    perform realtime.send('{}'::jsonb, event, 'p:' || key, true);
  exception when others then
    raise warning 'poke not sent: %', sqlerrm;
  end;
end
$$;
revoke all on function game.poke(uuid, text) from public, anon, authenticated;
