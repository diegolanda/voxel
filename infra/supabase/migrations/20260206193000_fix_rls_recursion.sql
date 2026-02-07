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

commit;
