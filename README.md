# Voxel Worlds

Browser-based multiplayer voxel game for up to 5 players per room. Build collaboratively in procedurally-generated worlds with real-time block editing, spatial voice chat, and persistent saves.

**Status:** MVP — Phase 1-4 complete (auth, rooms, engine, multiplayer contracts, world persistence).

## Architecture

```
apps/web          Next.js 16 app (SSR + client)
packages/
  domain          Shared domain models, block types, quality presets
  protocol        Zod message schemas (signaling, state frames, block edits, snapshots)
  worldgen        Deterministic terrain generation (Forest / Snow / Coast)
  engine          Three.js voxel renderer, physics, input, greedy meshing
  realtime        WebRTC multiplayer sync contracts
  voice           Voice capture and spatial audio contracts
  supabase        Auth / DB / Storage integration
  ui              Reusable UI primitives
  config          Runtime configuration
  testing         Playwright E2E test suite
infra/
  supabase        SQL migrations and RLS policies
  turn            TURN server deployment notes
docs/mvp          PRD, task definition, delivery plan, runbook
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Three.js 0.180, Zustand |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Multiplayer | WebRTC peer-to-peer mesh, Supabase Realtime channels |
| Voice | Web Audio API with spatial panning |
| Validation | Zod 4 |
| Monorepo | PNPM 10 workspaces + Turborepo |
| CI | GitHub Actions (typecheck, build, Playwright E2E) |
| Language | TypeScript 5.8 (strict) |

## Prerequisites

- **Node.js** >= 20.11.0
- **PNPM** 10 (via Corepack: `corepack enable`)
- **Supabase** project (free tier works for development)
- **TURN server** for WebRTC NAT traversal (e.g. [Metered](https://www.metered.ca/) or self-hosted [Coturn](https://github.com/coturn/coturn))

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url> && cd voxel
corepack enable
pnpm install

# 2. Configure environment
cp .env.example apps/web/.env.local
# Edit apps/web/.env.local — fill in Supabase and TURN credentials

# 3. Apply database migrations
npx supabase link --project-ref <your-project-ref>
npx supabase db push

# 4. Start dev server
pnpm dev
# Open http://localhost:3000
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all workspace dev servers |
| `pnpm build` | Build all packages and the web app |
| `pnpm typecheck` | TypeScript type checking across all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run unit and E2E tests |
| `pnpm clean` | Remove all build artifacts and node_modules |

## Environment Variables

Copy `.env.example` to `apps/web/.env.local` and fill in your values. See the full variable reference in [docs/mvp/runbook.md](docs/mvp/runbook.md#environment-variables).

**Important:** Never commit `.env` files. The `.gitignore` is configured to block all `.env*` variants except `.env.example`.

## Database Migrations

Migrations live in `infra/supabase/migrations/` and are applied with the Supabase CLI:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

See [infra/supabase/README.md](infra/supabase/README.md) for migration details and RLS policy documentation.

## Testing

```bash
# Run all tests
pnpm test

# Run E2E tests only
pnpm --filter @voxel/testing test:install   # install Playwright browsers (first time)
pnpm --filter @voxel/testing test
```

CI runs typecheck + build + E2E on every push and PR to `main`. Playwright reports are uploaded as artifacts on failure.

## Deployment

See the full [Deployment Runbook](docs/mvp/runbook.md) for:
- Vercel and Docker deployment steps
- Pre-deploy and post-deploy checklists
- Environment variable reference
- Rollback procedures
- Troubleshooting guide

## Project Limits

- 5 players max per room
- 3 worlds max per account
- 10 MB max save file size
- Chrome desktop + Chrome iPadOS (other browsers best-effort)

## Security

- **Authentication:** Email OTP via Supabase Auth
- **Authorization:** Row-Level Security (RLS) on all database tables
- **Rate limiting:** Password-join throttling via `app_private.join_attempts`
- **TURN credentials:** Served server-side only via `/api/turn/credentials` (requires auth)
- **Secrets:** All credentials read from environment variables at runtime — no hardcoded secrets in source

Report security issues privately — do not open public issues for vulnerabilities.

## License

Private. All rights reserved.
