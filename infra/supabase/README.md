# Supabase Infra

Phase 1 migration is implemented:
- `migrations/20260206191000_phase1_foundation.sql`

It includes:
- `profiles`, `rooms`, `room_members` tables
- private `app_private.join_attempts` table for password join throttling
- RLS policies for profile, room, and membership access
- host-membership and profile bootstrap triggers
- backend world ownership cap enforcement (max 3 active worlds per host)
