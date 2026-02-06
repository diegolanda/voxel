# Voxel Worlds Monorepo

Workspace bootstrap for the **Voxel Worlds MVP** PRD (updated February 6, 2026).

## Scope of this bootstrap
- Workspace and task-runner setup (`pnpm` + `turbo`)
- PRD-aligned app/package topology
- MVP task definition and phased delivery plan
- No gameplay or product feature implementation yet

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

## PRD references
- Source PDF: `Voxel_Worlds_PRD.pdf`
- Extracted text: `docs/Voxel_Worlds_PRD.extracted.txt`
- MVP tasks: `docs/mvp/task-definition.md`
- Delivery plan: `docs/mvp/delivery-plan.md`
