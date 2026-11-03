-- Pin search_path on require_uid (Supabase linter 0011). auth.uid() is schema-qualified.
alter function app_private.require_uid() set search_path = '';
