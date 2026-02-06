# @voxel/web

Next.js app for Voxel Worlds MVP.

## Intended route groups
- `/`: landing page
- `/signup`, `/login`: auth entry
- `/app`: dashboard and room management
- `/app/rooms/[id]`: room details + launch
- `/play/[roomId]`: in-game canvas + HUD overlay

## Current state
- Phase 1 foundation implemented:
  - Supabase email OTP authentication routes
  - Dashboard with profile update and room creation
  - Invite join route with server-side password validation + throttling
  - Room detail with member list and host kick control
