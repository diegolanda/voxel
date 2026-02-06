# Voxel Worlds MVP Delivery Plan

Plan date: **February 6, 2026**

## Planning assumptions
- PRD scope is locked (no open scope questions).
- Team executes epics in dependency order.
- This document defines delivery sequencing, quality gates, and rollout checkpoints.

## Phase order

### Phase 0: Bootstrap complete
- Workspace, package boundaries, and task definitions established.
- Exit criteria: monorepo structure and MVP backlog are committed.

### Phase 1: Product foundation and room security (E1 + E2)
- Build auth, profile baseline, room creation/join, invite + password validation.
- Add RLS and world cap enforcement (max 3 worlds/account).
- Exit criteria:
  - user can sign up/login and create room
  - guest can join only with invite token + valid password
  - host can view members and kick

### Phase 2: Engine baseline (E3)
- Implement deterministic world generation, chunking, meshing, and controls.
- Validate device controls for desktop and iPad Chrome paths.
- Exit criteria:
  - same seed => same terrain across clients
  - place/break loop stable
  - baseline FPS targets reachable in representative scene

### Phase 3: Multiplayer and voice transport (E4 + E5)
- Implement signaling, WebRTC mesh, state replication, and spatial voice APIs.
- TURN becomes mandatory release gate.
- Exit criteria:
  - two users on different networks connect with TURN
  - block edits sync under 500ms typical WAN
  - spatial voice effect is perceptible and reliable

### Phase 4: Persistence and resume (E6)
- Implement snapshot/diff format, compression, storage references, and resume logic.
- Exit criteria:
  - host save/resume works correctly
  - save size target maintained for typical session

### Phase 5: Hardening and release readiness (E7)
- Add observability, quality presets, E2E coverage, and deployment runbook.
- Exit criteria:
  - CI green with happy-path tests
  - new contributor local setup <15 minutes
  - known limits tracked and documented

## Critical path
1. `E1-T2` auth integration
2. `E2-T1` room schema/RLS
3. `E2-T4` secure join/password validation
4. `E3-T3` chunk + meshing worker pipeline
5. `E4-T2` WebRTC session manager with TURN
6. `E4-T5` late-join protocol
7. `E6-T3` resume flow
8. `E7-T3` E2E gate in CI

## Release gates (must-pass)
- Security gate: password hashing + RLS + rate limiting verified
- Performance gate: >=50 FPS desktop and >=30 FPS iPad median in defined benchmark scene
- Reliability gate: reconnect + late join + save/resume manual QA checklist passed
- Compliance gate: privacy policy and analytics event inventory updated

## Risk control checkpoints
- End of Phase 1: security model review (auth, RLS, password handling)
- End of Phase 2: performance review on desktop + iPad profile
- End of Phase 3: network reliability test with TURN under adverse conditions
- End of Phase 4: storage cost and save size review
