-- Phase 7 (3/4): pg_cron + pg_net plumbing (installed only where available).

-- ---------------------------------------------------------------------------
-- Cron plumbing (pg_cron + pg_net, only where available: the hosted project).
-- ---------------------------------------------------------------------------
create function app_private.cron_secret_ok(p_secret text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select secret = p_secret from app_private.cron_config where id), false)
$$;

-- Fire-and-forget call from pg_cron to an Edge Function.
create function app_private.call_function(p_name text, p_body jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  cfg app_private.cron_config;
begin
  select * into cfg from app_private.cron_config where id;
  if cfg is null then
    raise warning 'cron_config missing: % not called', p_name;
    return;
  end if;
  perform net.http_post(
    url := cfg.functions_url || '/' || p_name,
    body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', cfg.secret),
    timeout_milliseconds := 60000
  );
end $$;

-- (Re)creates the schedules. Paris time moves between UTC+1 and UTC+2, so each job runs at
-- both UTC hours; the functions are idempotent and gate on Paris time themselves.
create function app_private.install_cron_jobs() returns text
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    return 'skipped: pg_cron / pg_net not installed';
  end if;
  execute $sql$ select cron.schedule('noskip-close-week', '0 18,19 * * 0',
    $job$ select app_private.call_function('close-week', '{"step":"close"}'::jsonb) $job$) $sql$;
  execute $sql$ select cron.schedule('noskip-week-recap', '5 18,19 * * 0',
    $job$ select app_private.call_function('close-week', '{"step":"recap"}'::jsonb) $job$) $sql$;
  execute $sql$ select cron.schedule('noskip-midweek-check', '0 16,17 * * *',
    $job$ select app_private.call_function('midweek-check', '{}'::jsonb) $job$) $sql$;
  return 'scheduled';
end $$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
    perform app_private.install_cron_jobs();
  end if;
end $$;

revoke all on function
  app_private.cron_secret_ok(text),
  app_private.call_function(text, jsonb),
  app_private.install_cron_jobs()
from public;
grant execute on function app_private.cron_secret_ok(text) to service_role;
