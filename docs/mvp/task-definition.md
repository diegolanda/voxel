# Voxel Worlds MVP Task Definition

Derived from PRD `v5` updated **February 6, 2026**.

## Scope lock
- Browser targets: Chrome desktop + Chrome iPadOS
- Max players per room: 5
- Core stack: Next.js + Supabase + WebRTC + Web Audio API
- Themes: forest, snow, coast
- Out-of-scope features in PRD remain excluded

## Execution model
- All tasks map to epics `E1` through `E7` in the PRD.
- Every task has one owning workspace and explicit dependencies.
- Exit criteria are based on PRD Definition of Done and performance/security constraints.

## Task list by epic

### E1 Product Foundation (Next.js + Supabase)
| Task ID | Task | Owner workspace | Depends on | Done when |
| --- | --- | --- | --- | --- |
| E1-T1 | Configure app shell, env loading, lint/typecheck gates | `apps/web`, `packages/config` | bootstrap | local app boots and CI quality gates pass |
| E1-T2 | Integrate Supabase email OTP auth flows | `apps/web`, `packages/supabase` | E1-T1 | signup/login/logout and session handling work |
| E1-T3 | Add `profiles` model and RLS policy definitions | `infra/supabase`, `packages/domain` | E1-T2 | profile create/update constrained by RLS |
| E1-T4 | Build landing + terms/privacy placeholders | `apps/web`, `packages/ui` | E1-T1 | required landing sections and SEO baseline present |

### E2 Rooms (Create/Join/Invite/Password)
| Task ID | Task | Owner workspace | Depends on | Done when |
| --- | --- | --- | --- | --- |
| E2-T1 | Implement rooms and room_members schema + RLS | `infra/supabase`, `packages/supabase` | E1-T3 | membership and host role enforced by policy |
| E2-T2 | Implement create room flow with theme/seed/password | `apps/web`, `packages/domain` | E2-T1 | host can create a room with secure password hash |
| E2-T3 | Implement invite link generation and join entry flow | `apps/web` | E2-T2 | invite link includes token; join route validates token |
| E2-T4 | Implement server-side password validation + rate limit | `apps/web`, `packages/supabase` | E2-T3 | incorrect password blocked; attempts throttled |
| E2-T5 | Build room detail page with members, launch, and host controls | `apps/web`, `packages/ui` | E2-T4 | member list accurate; launch and host actions visible |
| E2-T6 | Enforce world ownership cap (max 3) in UI and backend | `apps/web`, `infra/supabase` | E2-T2 | cannot create fourth world from UI or API |
| E2-T7 | Implement host kick with presence and transport disconnect | `apps/web`, `packages/realtime`, `packages/voice` | E2-T5 | kicked guest removed from room + voice/data |

### E3 Voxel Engine Core (Three.js)
| Task ID | Task | Owner workspace | Depends on | Done when |
| --- | --- | --- | --- | --- |
| E3-T1 | Create renderer/camera/lighting/skybox runtime shell | `packages/engine`, `apps/web` | E1-T1 | scene mounts reliably and resizes correctly |
| E3-T2 | Implement deterministic worldgen contracts for 3 themes | `packages/worldgen`, `packages/domain` | E3-T1 | same seed produces identical terrain on clients |
| E3-T3 | Add chunking + meshing worker pipeline contract | `packages/engine` | E3-T2 | chunk updates isolated and meshing off main thread |
| E3-T4 | Add movement/controller contracts for desktop + iPad | `packages/engine`, `apps/web` | E3-T1 | control abstraction supports both device targets |
| E3-T5 | Define block interaction + hotbar/inventory HUD contract | `packages/engine`, `packages/ui`, `apps/web` | E3-T3 | place/break interface and HUD API stabilized |

### E4 Multiplayer Sync (<=5)
| Task ID | Task | Owner workspace | Depends on | Done when |
| --- | --- | --- | --- | --- |
| E4-T1 | Define signaling channel contracts and room presence model | `packages/realtime`, `packages/protocol` | E2-T1 | channel naming and payload schemas versioned |
| E4-T2 | Implement WebRTC peer/session manager contract | `packages/realtime` | E4-T1 | supports mesh for up to 5 peers |
| E4-T3 | Define player-state replication at 10-20 Hz with interpolation API | `packages/realtime`, `packages/domain` | E4-T2 | remote state stream API supports smoothing |
| E4-T4 | Define host-ordered block edit sequencing and conflict policy | `packages/protocol`, `packages/realtime` | E3-T5, E4-T2 | sequence and last-write-wins behavior encoded |
| E4-T5 | Define late join sync protocol (base + snapshot + replay) | `packages/realtime`, `packages/supabase` | E4-T4, E6-T1 | late join protocol contract complete |

### E5 Voice + Spatial Audio
| Task ID | Task | Owner workspace | Depends on | Done when |
| --- | --- | --- | --- | --- |
| E5-T1 | Define microphone capture and permission handling flow | `packages/voice`, `apps/web` | E1-T2 | mic denied path keeps gameplay available |
| E5-T2 | Define remote stream spatialization pipeline | `packages/voice` | E5-T1 | source -> panner -> gain chain contract established |
| E5-T3 | Define positional update API linked to avatar transforms | `packages/voice`, `packages/realtime` | E4-T3, E5-T2 | 10-20 Hz position update contract with smoothing |
| E5-T4 | Define HUD controls for mute/unmute/volume | `packages/ui`, `apps/web`, `packages/voice` | E5-T1 | user-level voice controls exposed in HUD contract |

### E6 World Saves (Persist & Resume)
| Task ID | Task | Owner workspace | Depends on | Done when |
| --- | --- | --- | --- | --- |
| E6-T1 | Define snapshot and chunk-diff serialization format | `packages/protocol`, `packages/engine` | E3-T3 | format version documented and testable |
| E6-T2 | Define compression and storage adapter contracts | `packages/supabase`, `packages/domain` | E6-T1 | save adapter API supports compressed payloads |
| E6-T3 | Define load/resume workflow using latest snapshot + events | `packages/realtime`, `packages/supabase` | E6-T2, E4-T5 | resume flow contract complete and version aware |

### E7 Hardening, Monitoring, Release
| Task ID | Task | Owner workspace | Depends on | Done when |
| --- | --- | --- | --- | --- |
| E7-T1 | Define error tracking envelope and logging taxonomy | `apps/web`, `packages/domain` | E1-T1 | runtime errors mapped to actionable categories |
| E7-T2 | Define quality preset matrix by device profile | `packages/engine`, `apps/web` | E3-T3 | low/medium/high defaults codified |
| E7-T3 | Define Playwright happy-path suites and CI gates | `packages/testing`, `apps/web` | E2-T5, E4-T2, E6-T3 | E2E coverage map aligns to PRD section 15 |
| E7-T4 | Define deployment pipeline and runbook checklist | root, `apps/web`, `infra/*` | E7-T3 | reproducible deploy/runbook published |

## Cross-epic acceptance gates
| Gate | Requirement |
| --- | --- |
| Security | Password hashing server-side, RLS enforcement, invite token entropy, join throttling |
| Performance | Desktop median >=50 FPS, iPadOS >=30 FPS, join-to-play median <20s |
| Networking | TURN required and configured for voice + data paths |
| Reliability | Late join and reconnect scenarios documented and covered in manual QA checklist |
| Privacy | No voice recording, minimal analytics identifiers, policy updates captured |

## Explicitly deferred beyond MVP
- Public matchmaking and world discovery
- Survival systems (health, crafting, combat)
- Modding and marketplace
- Phone-first support
