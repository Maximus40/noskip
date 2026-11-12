-- Device test: avatar uploads failed with 400. Storage needs a SELECT policy on the player's
-- own folder (upload returns the stored row; upsert also reads it). Reads of other players'
-- photos still go through the public URL only.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage')
     and not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
                     and policyname = 'avatars: owner reads own folder') then
    create policy "avatars: owner reads own folder" on storage.objects
      for select to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;

-- Recent iPhones produce large or HEIC photos: allow up to 8 MB and HEIC/HEIF.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    update storage.buckets
       set file_size_limit = 8388608,
           allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
     where id = 'avatars';
  end if;
end $$;
