-- Query cache for the search-gyms Edge Function (Overpass is slow and rate-limited).
-- Keys hold a coarse (≈1 km) rounded point or a normalised name, never a raw position.
create table public.gym_search_cache (
  key text primary key check (char_length(key) <= 200),
  gym_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.gym_search_cache enable row level security;
revoke all on public.gym_search_cache from anon, authenticated;
grant all on public.gym_search_cache to service_role;

-- Avatars bucket (only where Supabase Storage exists; skipped by the local test shim).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    execute $p$
      create policy "avatars: owner writes own folder" on storage.objects
        for insert to authenticated
        with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
    $p$;
    execute $p$
      create policy "avatars: owner updates own folder" on storage.objects
        for update to authenticated
        using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
    $p$;
    execute $p$
      create policy "avatars: owner deletes own folder" on storage.objects
        for delete to authenticated
        using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
    $p$;
  end if;
end $$;
