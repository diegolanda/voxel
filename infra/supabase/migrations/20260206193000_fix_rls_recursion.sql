begin;

-- ── Fix: infinite recursion in room_members RLS ─────────────────────
--
-- The room_members SELECT policy was self-referencing: it queried
-- room_members to verify the viewer is a co-member, which triggered
-- the same policy again → infinite recursion.  Every other table's
-- SELECT policy that joins room_members hit the same loop.
--
-- Fix: SECURITY DEFINER helpers that bypass RLS for the membership
-- check, breaking the cycle.

-- 1) Check whether a specific user belongs to a specific room.
create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.room_members
     where room_id = p_room_id
       and user_id = p_user_id
  );
$$;

-- 2) Check whether two users share at least one room.
create or replace function public.shares_room_with(p_viewer_id uuid, p_target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.room_members a
      join public.room_members b on a.room_id = b.room_id
     where a.user_id = p_viewer_id
       and b.user_id = p_target_user_id
  );
$$;

-- Lock helpers to authenticated callers only.
revoke all on function public.is_room_member(uuid, uuid) from public, anon;
grant execute on function public.is_room_member(uuid, uuid) to authenticated;

revoke all on function public.shares_room_with(uuid, uuid) from public, anon;
grant execute on function public.shares_room_with(uuid, uuid) to authenticated;

-- ── Recreate affected policies ──────────────────────────────────────

-- room_members SELECT  (root cause of the recursion)
drop policy if exists "room_members_select_for_members" on public.room_members;
create policy "room_members_select_for_members"
  on public.room_members
  for select
  using (
    public.is_room_member(room_id, auth.uid())
  );

-- rooms SELECT  (was joining room_members → hit the recursive policy)
drop policy if exists "rooms_select_members_only" on public.rooms;
create policy "rooms_select_members_only"
  on public.rooms
  for select
  using (
    host_id = auth.uid()
    or public.is_room_member(id, auth.uid())
  );

-- profiles SELECT  (joined room_members twice → same recursion)
drop policy if exists "profiles_select_visible_to_room_members" on public.profiles;
create policy "profiles_select_visible_to_room_members"
  on public.profiles
  for select
  using (
    auth.uid() = user_id
    or public.shares_room_with(auth.uid(), user_id)
  );

-- world_saves SELECT  (joined room_members for membership check)
drop policy if exists "world_saves_select_members" on public.world_saves;
create policy "world_saves_select_members"
  on public.world_saves
  for select
  using (
    public.is_room_member(room_id, auth.uid())
  );

-- ── Fix: room_members INSERT/UPDATE/DELETE policies ──────────────────
--
-- Even with ensure_host_membership() as SECURITY DEFINER, the WITH CHECK
-- clause of room_members_insert_host_only still runs and tries to SELECT
-- from rooms to verify the host. This triggers rooms_select_members_only
-- which requires membership — creating a circular dependency.
--
-- Solution: Use a SECURITY DEFINER helper to check room ownership.

-- Helper function to check if a user is the host of a room
create or replace function public.is_room_host(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.rooms
     where id = p_room_id
       and host_id = p_user_id
  );
$$;

-- Grant execute to authenticated users only
revoke all on function public.is_room_host(uuid, uuid) from public, anon;
grant execute on function public.is_room_host(uuid, uuid) to authenticated;

-- Recreate room_members policies using the helper function
drop policy if exists "room_members_insert_host_only" on public.room_members;
create policy "room_members_insert_host_only"
  on public.room_members
  for insert
  with check (
    public.is_room_host(room_id, auth.uid())
  );

drop policy if exists "room_members_update_host_only" on public.room_members;
create policy "room_members_update_host_only"
  on public.room_members
  for update
  using (
    public.is_room_host(room_id, auth.uid())
  )
  with check (
    public.is_room_host(room_id, auth.uid())
  );

drop policy if exists "room_members_delete_host_or_self" on public.room_members;
create policy "room_members_delete_host_or_self"
  on public.room_members
  for delete
  using (
    auth.uid() = user_id
    or public.is_room_host(room_id, auth.uid())
  );

-- ── Replace trigger with RPC function ────────────────────────────────
--
-- Even with the above fixes, triggers still hit edge cases. Replace the
-- trigger-based approach with a server-side RPC function that creates
-- both room and membership atomically, bypassing all RLS.

-- Drop the existing trigger
drop trigger if exists trg_rooms_host_member on public.rooms;

-- Create a secure RPC function to create a room with host membership
create or replace function public.create_room_with_host(
  p_name text,
  p_theme public.room_theme,
  p_seed text,
  p_password_hash text,
  p_max_players smallint default 5
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_host_id uuid;
begin
  -- Get the authenticated user
  v_host_id := auth.uid();
  
  if v_host_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Check world cap
  if (
    select count(*)
    from public.rooms
    where host_id = v_host_id
      and deleted_at is null
  ) >= 3 then
    raise exception using
      errcode = 'P0001',
      message = 'world_cap_reached';
  end if;

  -- Create the room
  insert into public.rooms (
    host_id,
    name,
    theme,
    seed,
    password_hash,
    max_players,
    invite_token
  )
  values (
    v_host_id,
    p_name,
    p_theme,
    p_seed,
    p_password_hash,
    p_max_players,
    gen_random_uuid()
  )
  returning id into v_room_id;

  -- Create the host membership (bypasses RLS since function is SECURITY DEFINER)
  insert into public.room_members (room_id, user_id, role)
  values (v_room_id, v_host_id, 'host');

  return v_room_id;
end;
$$;

-- Grant execute to authenticated users only
revoke all on function public.create_room_with_host(text, public.room_theme, text, text, smallint) from public, anon;
grant execute on function public.create_room_with_host(text, public.room_theme, text, text, smallint) to authenticated;

commit;
