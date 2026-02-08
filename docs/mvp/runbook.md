# Deployment Runbook — Voxel Worlds MVP

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service-role key (server only) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL (e.g. `https://voxel.example.com`) |
| `NEXT_PUBLIC_TURN_URL` | Yes | TURN server URL for WebRTC |
| `NEXT_PUBLIC_TURN_API_URL` | Yes | API path that returns ICE servers (default `/api/turn/credentials`) |
| `NEXT_PUBLIC_TURN_USERNAME` | Yes | TURN server username |
| `NEXT_PUBLIC_TURN_PASSWORD` | Yes | TURN server password |
| `TURN_URL` | Yes | Server-side TURN relay URL (e.g. `turns:global.relay.metered.ca:443`) |
| `TURN_USERNAME` | Yes | Server-side TURN credential username |
| `TURN_PASSWORD` | Yes | Server-side TURN credential password |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Sentry/error beacon endpoint |

## Database Migrations

1. Ensure Supabase CLI is installed: `npx supabase --version`
2. Link project: `npx supabase link --project-ref <ref>`
3. Push migrations: `npx supabase db push`
4. Verify RLS policies are active on `rooms`, `room_members`, `profiles`, `world_saves`

## Vercel Deployment

1. Connect repository in Vercel dashboard
2. Set root directory to `apps/web`
3. Framework preset: **Next.js**
4. Add all required environment variables
5. Deploy — Vercel auto-detects the monorepo and builds

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
  -e NEXT_PUBLIC_TURN_USERNAME=... \
  -e NEXT_PUBLIC_TURN_PASSWORD=... \
  -e TURN_URL=... \
  -e TURN_USERNAME=... \
  -e TURN_PASSWORD=... \
  voxel-web
```

## Pre-Deploy Checklist

- [ ] CI pipeline is green (typecheck + build + E2E)
- [ ] All environment variables are set in production
- [ ] Database migrations are applied (`supabase db push`)
- [ ] TURN server is reachable and credentials are valid
- [ ] Supabase storage bucket `world-snapshots` exists with RLS enabled
- [ ] RLS policies on all tables are active

## Post-Deploy Verification

1. **Landing page** — `/` renders, CTA links work
2. **Auth flow** — Sign up with email OTP, verify, redirect to dashboard
3. **Room creation** — Create a room from dashboard, verify it appears
4. **Game session** — Enter room, 3D canvas renders, blocks are interactable
5. **WebRTC** — Second browser tab joins, peers see each other
6. **Voice** — Enable voice, microphone permission prompt appears
7. **Save/Resume** — Host saves, reload page, world state is restored

## Known Limits

- **5 players** max per room
- **3 worlds** max per account
- **10 MB** max save file size
- **Chrome-only** — tested against Desktop Chrome; other browsers are best-effort
- WebRTC mesh topology — not suitable for >5 peers

## Rollback Procedure

1. **Vercel**: Redeploy previous Production deployment from the Vercel dashboard → Deployments tab
2. **Docker**: Stop current container, re-tag and run the previous image
3. **Database**: If a migration caused issues, apply a reverse migration via `supabase db push` with a new migration file. Avoid `supabase db reset` in production.
