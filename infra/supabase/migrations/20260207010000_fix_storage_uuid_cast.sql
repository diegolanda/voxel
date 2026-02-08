begin;

-- ── Fix: guard UUID cast + use SECURITY DEFINER helpers ─────────────────
--
-- Two problems with the original storage policies:
-- 1. storage.objects is shared across all buckets. Postgres does not guarantee
--    short-circuit AND, so (split_part(name, '/', 1))::uuid can be evaluated
--    on rows from other buckets where the prefix is not a UUID.
-- 2. Direct subqueries against rooms/room_members are subject to their own
--    RLS policies, causing nested RLS failures. Must use the existing
--    SECURITY DEFINER helpers (is_room_host, is_room_member) instead.

-- Helper: safely cast text to uuid, returns null on invalid input.
create or replace function public.try_cast_uuid(val text)
  returns uuid
  language plpgsql
  immutable
as $$
begin
  return val::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

-- Drop and recreate all three policies.
drop policy if exists "world_snapshots_select_members" on storage.objects;
drop policy if exists "world_snapshots_insert_host" on storage.objects;
drop policy if exists "world_snapshots_delete_host" on storage.objects;

create policy "world_snapshots_select_members"
  on storage.objects
  for select
  using (
    bucket_id = 'world-snapshots'
    and auth.role() = 'authenticated'
    and public.is_room_member(
      public.try_cast_uuid(split_part(name, '/', 1)),
      auth.uid()
    )
  );

create policy "world_snapshots_insert_host"
  on storage.objects
  for insert
  with check (
    bucket_id = 'world-snapshots'
    and auth.role() = 'authenticated'
    and public.is_room_host(
      public.try_cast_uuid(split_part(name, '/', 1)),
      auth.uid()
    )
  );

create policy "world_snapshots_delete_host"
  on storage.objects
  for delete
  using (
    bucket_id = 'world-snapshots'
    and auth.role() = 'authenticated'
    and public.is_room_host(
      public.try_cast_uuid(split_part(name, '/', 1)),
      auth.uid()
    )
  );

commit;
