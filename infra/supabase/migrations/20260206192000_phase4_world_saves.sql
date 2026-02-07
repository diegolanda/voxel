begin;

-- ── World saves table ─────────────────────────────────────────────────
-- Stores references to compressed snapshot files in Supabase Storage.
-- One save per row; latest save per room is the resume target.

create table if not exists public.world_saves (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  base_sequence integer not null default 0,
  byte_size integer not null default 0,
  format_version smallint not null default 1,
  created_at timestamptz not null default timezone('utc', now()),

  constraint world_saves_storage_path_not_empty check (char_length(trim(storage_path)) > 0),
  constraint world_saves_byte_size_positive check (byte_size >= 0),
  constraint world_saves_base_sequence_nonneg check (base_sequence >= 0)
);

create index if not exists idx_world_saves_room_latest
  on public.world_saves (room_id, created_at desc);

create index if not exists idx_world_saves_created_by
  on public.world_saves (created_by);

-- ── RLS policies ──────────────────────────────────────────────────────

alter table public.world_saves enable row level security;

-- Members can read saves for rooms they belong to
create policy "world_saves_select_members"
  on public.world_saves
  for select
  using (
    exists (
      select 1
        from public.room_members membership
       where membership.room_id = world_saves.room_id
         and membership.user_id = auth.uid()
    )
  );

-- Only room host can create saves
create policy "world_saves_insert_host_only"
  on public.world_saves
  for insert
  with check (
    exists (
      select 1
        from public.rooms room
       where room.id = world_saves.room_id
         and room.host_id = auth.uid()
    )
    and created_by = auth.uid()
  );

-- Only room host can delete saves
create policy "world_saves_delete_host_only"
  on public.world_saves
  for delete
  using (
    exists (
      select 1
        from public.rooms room
       where room.id = world_saves.room_id
         and room.host_id = auth.uid()
    )
  );

-- ── Grants ────────────────────────────────────────────────────────────

grant select, insert, delete
  on public.world_saves
  to authenticated;

-- ── Supabase Storage bucket (declarative reference) ───────────────────
-- The bucket 'world-snapshots' must be created in the Supabase dashboard
-- or via supabase CLI. Files stored at: world-snapshots/{roomId}/{saveId}.vxs.gz

commit;
