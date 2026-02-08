begin;

-- ── Storage RLS policies for the 'world-snapshots' bucket ───────────────
-- Path format: {roomId}/{saveId}.vxs.gz
-- split_part(name, '/', 1) extracts the roomId from the object path.

-- Room members can read (download) snapshots
create policy "world_snapshots_select_members"
  on storage.objects
  for select
  using (
    bucket_id = 'world-snapshots'
    and auth.role() = 'authenticated'
    and exists (
      select 1
        from public.room_members membership
       where membership.room_id = (split_part(name, '/', 1))::uuid
         and membership.user_id = auth.uid()
    )
  );

-- Room host can upload snapshots
create policy "world_snapshots_insert_host"
  on storage.objects
  for insert
  with check (
    bucket_id = 'world-snapshots'
    and auth.role() = 'authenticated'
    and exists (
      select 1
        from public.rooms room
       where room.id = (split_part(name, '/', 1))::uuid
         and room.host_id = auth.uid()
    )
  );

-- Room host can delete snapshots
create policy "world_snapshots_delete_host"
  on storage.objects
  for delete
  using (
    bucket_id = 'world-snapshots'
    and auth.role() = 'authenticated'
    and exists (
      select 1
        from public.rooms room
       where room.id = (split_part(name, '/', 1))::uuid
         and room.host_id = auth.uid()
    )
  );

commit;
