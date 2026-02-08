# Deployment Runbook — Voxel Worlds MVP

## Environment Variables

### Required

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_APP_URL` | Client + Server | Public app URL (e.g. `https://voxel.example.com`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase anonymous key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** | Supabase service-role key — never expose to client |
| `TURN_URL` | **Server only** | TURN relay URL (e.g. `turns:global.relay.metered.ca:443?transport=tcp`) |
| `TURN_USERNAME` | **Server only** | TURN credential username |
| `TURN_PASSWORD` | **Server only** | TURN credential password |
| `NEXT_PUBLIC_TURN_URL` | Client | TURN server public URL (for initial connectivity check) |
| `NEXT_PUBLIC_TURN_API_URL` | Client | API path returning ICE servers (default `/api/turn/credentials`) |

### Optional

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_ENV` | Client | Environment label (`development`, `staging`, `production`) |
| `NEXT_PUBLIC_SENTRY_DSN` | Client | Sentry error reporting endpoint |
| `SENTRY_AUTH_TOKEN` | **Server only** | Sentry auth token for source map uploads |
| `NEXT_PUBLIC_ANALYTICS_WRITE_KEY` | Client | Analytics write key |

### Channel Prefixes (defaults usually work)

| Variable | Default |
|----------|---------|
| `NEXT_PUBLIC_SIGNAL_CHANNEL_PREFIX` | `signal:room:` |
| `NEXT_PUBLIC_PRESENCE_CHANNEL_PREFIX` | `presence:room:` |
| `NEXT_PUBLIC_EVENTS_CHANNEL_PREFIX` | `events:room:` |

> **Security note:** TURN credentials (`TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD`) must be server-side only. They are served to authenticated clients via the `/api/turn/credentials` API route. Do **not** use `NEXT_PUBLIC_` prefixed variants for sensitive TURN credentials — the `NEXT_PUBLIC_` prefix causes Next.js to bundle them into client JavaScript.

## Database Migrations

1. Install Supabase CLI: `npx supabase --version`
2. Link project: `npx supabase link --project-ref <ref>`
3. Push all migrations: `npx supabase db push`
4. Verify RLS policies are active:
   ```sql
   SELECT tablename, policyname FROM pg_policies
   WHERE schemaname = 'public'
   ORDER BY tablename;
   ```
5. Verify storage bucket exists:
   ```sql
   SELECT id, name, public FROM storage.buckets
   WHERE name = 'world-snapshots';
   ```

### Migration files

| Order | File | Purpose |
|-------|------|---------|
| 1 | `20260206191000_phase1_foundation.sql` | Profiles, rooms, room_members, RLS, OTP auth |
| 2 | `20260206192000_phase4_world_saves.sql` | World save snapshots |
| 3 | `20260206193000_fix_rls_recursion.sql` | SECURITY DEFINER helpers, RPC functions |
| 4 | `20260207000000_storage_policies_world_snapshots.sql` | Storage bucket RLS |
| 5 | `20260207010000_fix_storage_uuid_cast.sql` | UUID casting fix |

## Vercel Deployment

1. Connect repository in Vercel dashboard
2. Set root directory to `apps/web`
3. Framework preset: **Next.js**
4. Build command: `pnpm build` (Vercel auto-detects monorepo via `turbo.json`)
5. Add **all required** environment variables in Vercel project settings
6. Deploy

> Tip: Use Vercel's "Environment Variables" UI to set different values per environment (Production / Preview / Development).

## Docker Deployment

Build from the repo root:

```bash
docker build -f apps/web/Dockerfile -t voxel-web .
```

Run:

```bash
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e NEXT_PUBLIC_APP_URL=... \
  -e NEXT_PUBLIC_TURN_URL=... \
  -e NEXT_PUBLIC_TURN_API_URL=/api/turn/credentials \
  -e TURN_URL=... \
  -e TURN_USERNAME=... \
  -e TURN_PASSWORD=... \
  voxel-web
```

## Pre-Deploy Checklist

### Build & Tests
- [ ] CI pipeline is green (typecheck + build + E2E)
- [ ] `pnpm build` succeeds locally with production env vars
- [ ] E2E tests pass against staging environment

### Infrastructure
- [ ] All required environment variables are set in the deployment target
- [ ] Database migrations are applied (`npx supabase db push`)
- [ ] RLS policies on `rooms`, `room_members`, `profiles`, `world_saves` are active
- [ ] Supabase storage bucket `world-snapshots` exists with RLS enabled
- [ ] TURN server is reachable and credentials are valid

### Security
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is **not** prefixed with `NEXT_PUBLIC_`
- [ ] `TURN_USERNAME` and `TURN_PASSWORD` are **not** prefixed with `NEXT_PUBLIC_`
- [ ] No `.env` files are committed to git (`git ls-files | grep '\.env'` returns only `.env.example`)
- [ ] Supabase RLS is enabled on all public tables (no tables with `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`)
- [ ] Email OTP rate limits are configured in Supabase Auth settings

## Post-Deploy Verification

Run through these checks after each production deployment:

1. **Landing page** — `/` renders, CTA links work
2. **Auth flow** — Sign up with email OTP, verify code, redirect to dashboard
3. **Room creation** — Create a room from dashboard, verify it appears in room list
4. **Invite flow** — Copy invite link, open in incognito, join with password
5. **Game session** — Enter room, 3D canvas renders, blocks are interactable
6. **Multiplayer** — Second browser tab joins, peers see each other, block edits sync
7. **Voice** — Enable voice, microphone permission prompt appears
8. **Save/Resume** — Host saves world, reload page, world state is restored
9. **Host controls** — Kick a member, verify they are removed

## Monitoring & Observability

### Error Tracking
- Configure `NEXT_PUBLIC_SENTRY_DSN` for client-side error reporting
- Configure `SENTRY_AUTH_TOKEN` for source map uploads during build

### Key Metrics to Monitor
- **WebRTC connection success rate** — track ICE connection failures in Sentry
- **TURN server availability** — monitor `/api/turn/credentials` response times
- **Supabase Realtime** — monitor channel subscription counts and message throughput
- **World save size** — alert if saves approach the 10 MB limit
- **Auth rate limiting** — monitor `join_attempts` table for brute-force patterns

### Health Check Endpoints
- `GET /` — landing page (200 OK confirms app is running)
- `GET /api/turn/credentials` — returns 401 (confirms API routes work; 503 means TURN not configured)

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| "TURN server not configured" (503) | `TURN_URL`, `TURN_USERNAME`, or `TURN_PASSWORD` env vars missing | Set all three TURN env vars in deployment config |
| WebRTC peers can't connect | TURN server unreachable or credentials expired | Verify TURN server status; rotate credentials if expired |
| "Invalid OTP" on login | Supabase auth rate limits or clock skew | Check Supabase Auth logs; verify server clock is synced |
| World save fails | Storage bucket missing or RLS policy blocking | Run migration `20260207000000_storage_policies_world_snapshots.sql`; verify bucket exists |
| 3D canvas blank / black screen | WebGL not available or Three.js initialization error | Check browser console; ensure Chrome desktop or iPad Chrome |
| Build fails in CI | Missing env vars during build | `NEXT_PUBLIC_*` vars must be set at build time; server-only vars at runtime |
| RLS recursion errors | Migrations applied out of order | Ensure `20260206193000_fix_rls_recursion.sql` is applied |

## Secret Rotation

When rotating credentials, update them in **all** locations:

### Supabase Keys
1. Rotate keys in Supabase dashboard → Settings → API
2. Update `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in deployment config
3. Redeploy the application
4. Verify auth flow works end-to-end

### TURN Credentials
1. Rotate in your TURN provider dashboard (Metered, Coturn, etc.)
2. Update `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD` in deployment config
3. Redeploy — existing WebRTC sessions will need to reconnect

### Sentry / Analytics Tokens
1. Rotate in respective provider dashboards
2. Update env vars and redeploy

## Known Limits

- **5 players** max per room (WebRTC mesh — not suitable for more)
- **3 worlds** max per account
- **10 MB** max save file size
- **Chrome-only** — tested on Desktop Chrome and Chrome iPadOS; other browsers best-effort
- **No Dockerfile yet** — Docker deployment section is a placeholder for when a Dockerfile is added

## Rollback Procedure

1. **Vercel**: Redeploy previous Production deployment from the Vercel dashboard → Deployments tab
2. **Docker**: Stop current container, re-tag and run the previous image
3. **Database**: If a migration caused issues, apply a compensating migration via `npx supabase db push` with a new reverse-migration file. **Never** use `supabase db reset` in production.
4. **Emergency**: If the app is completely broken, roll back to the last known-good commit and redeploy:
   ```bash
   git log --oneline -10       # find last good commit
   # Redeploy that commit SHA via Vercel or rebuild Docker image
   ```
