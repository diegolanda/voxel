# Supabase Infra

## Migrations

### Phase 1: Foundation
**File**: `migrations/20260206191000_phase1_foundation.sql`

Core schema and policies:
- Tables: `profiles`, `rooms`, `room_members`
- Private table: `app_private.join_attempts` (password join throttling)
- RLS policies for profile, room, and membership access
- Bootstrap triggers for profile creation
- World ownership cap enforcement (max 3 active worlds per host)

### Phase 4: World Saves
**File**: `migrations/20260206192000_phase4_world_saves.sql`

Persistent world state:
- Table: `world_saves`
- RLS policies for world save access

### RLS Fixes
**File**: `migrations/20260206193000_fix_rls_recursion.sql`

Comprehensive RLS fixes:
- SECURITY DEFINER helper functions (`is_room_member`, `shares_room_with`, `is_room_host`)
- Updated SELECT policies to prevent infinite recursion
- RPC function `create_room_with_host()` for atomic room+membership creation
- Replaced trigger-based room membership with RPC to prevent circular RLS dependencies
