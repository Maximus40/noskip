-- Pin search_path on helper functions (Supabase linter 0011). All bodies are schema-qualified.
alter function app_private.paris_date(timestamptz) set search_path = '';
alter function app_private.monday_of(date) set search_path = '';
alter function app_private.game_week_start(timestamptz) set search_path = '';
alter function app_private.week_deadline(date) set search_path = '';
alter function app_private.touch_updated_at() set search_path = '';
alter function app_private.enforce_max_gyms() set search_path = '';
alter function app_private.new_invite_code() set search_path = '';
alter function app_private.next_plate_color(uuid) set search_path = '';
alter function app_private.sessions_derive() set search_path = '';

-- gym_search_cache is written and read by the search-gyms Edge Function only (service role);
-- RLS stays enabled with no policy on purpose so API roles get nothing.
comment on table public.gym_search_cache is 'Service-role only cache for search-gyms. No RLS policy by design.';
