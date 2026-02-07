# Voxel Worlds Monorepo

Workspace for the **Voxel Worlds MVP** PRD (updated February 6, 2026).

## Implemented scope
- Workspace and task-runner setup (`pnpm` + `turbo`)
- Supabase schema + RLS for profiles, rooms, and room membership
- Next.js Phase 1 flows: email OTP auth, dashboard, room create/join, invite join, host kick
- Phase 3 contracts for signaling, TURN-gated mesh session planning, sync interpolation, late-join replay, and spatial voice APIs
- MVP task definition and phased delivery plan

## Monorepo layout
- `apps/web`: Next.js app shell (landing, auth, dashboard, room, play routes)
- `packages/domain`: shared domain models and constants
- `packages/protocol`: message contracts and validation schemas
- `packages/worldgen`: deterministic terrain generation contracts
- `packages/engine`: voxel engine and rendering contracts
- `packages/realtime`: multiplayer signaling/data sync contracts
- `packages/voice`: voice capture and spatial audio contracts
- `packages/supabase`: auth/db/storage integration contracts
- `packages/ui`: reusable UI primitives for app + HUD
- `packages/testing`: shared test utilities and E2E harness contracts
- `infra/supabase`: migration and policy placeholders
- `infra/turn`: TURN deployment notes
- `docs/mvp`: MVP task definition and delivery plan

## Quick start
1. Enable Corepack: `corepack enable`
2. Install dependencies: `pnpm install`
3. Copy env template: `cp .env.example .env.local`
4. Run all workspace dev targets: `pnpm dev`

## Phase 1 notes
- Migration file: `infra/supabase/migrations/20260206191000_phase1_foundation.sql`
- App routes:
  - `/signup`, `/login` (email OTP)
  - `/app` (dashboard + profile + create room)
  - `/join/[roomId]` (invite/password join)
  - `/app/rooms/[id]` (members + host controls)

## PRD references
- Source PDF: `Voxel_Worlds_PRD.pdf`
- Extracted text: `docs/Voxel_Worlds_PRD.extracted.txt`
- MVP tasks: `docs/mvp/task-definition.md`
- Delivery plan: `docs/mvp/delivery-plan.md`
