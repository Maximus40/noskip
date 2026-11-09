-- Phase 8 (3/3): schedule monthly-belt on the 1st at 10:00 Paris (08:00 and 09:00 UTC; the
-- function waits for 10:00 Paris and is idempotent). Only where pg_cron + pg_net exist.

create or replace function app_private.install_cron_jobs() returns text
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
  execute $sql$ select cron.schedule('noskip-monthly-belt', '0 8,9 1 * *',
    $job$ select app_private.call_function('monthly-belt', '{}'::jsonb) $job$) $sql$;
  return 'scheduled';
end $$;

select app_private.install_cron_jobs();
