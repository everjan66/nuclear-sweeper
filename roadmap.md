# Nuclear Sweeper Roadmap

This roadmap coordinates developers. Items are proposed work, not release
promises. Use GitHub issues for scope and discussion and PRs for implementation.
Update this file as work lands.

## Current baseline

- Standalone browser game in `nuclear-sweeper-reactor.html`.
- Shelter gear, weapons, licenses, mastery, achievements, and radio UI.
- Source-style movement: [MOVEMENT.md](MOVEMENT.md).
- Three.js currently requires an internet connection.

## Multiplayer implementation

October 18, 2026: the private co-op implementation is available in the working
tree. See [MULTIPLAYER.md](MULTIPLAYER.md) for setup, source map and validation;
[MULTIPLAYER_PLAN.md](MULTIPLAYER_PLAN.md) remains the design reference.
Rows remain In progress until review/merge and the listed acceptance checks.

| Stage | Implementation | Status / remaining acceptance |
| --- | --- | --- |
| K1 - Shared simulation | DOM-free maps, movement and co-op simulation with explicit players; solo uses shared map/movement | In progress: solo combat/economy migration and gameplay parity review remain |
| K2 - Connections | Four-slot private signaling, host-star WebRTC, invitations, version/dev checks, ICE configuration | In progress: deployed TURN and separate-network checks remain |
| K3 - Synchronization | Fixed host ticks, prediction/replay, snapshots, dust updates, interpolation, confirmed transactions; packed wire v2 | In progress: 150 ms RTT/45 ms jitter/2% loss soak passes; payload reduced 41%; external backpressure/link qualification remains |
| K4 - Co-op gameplay | Shared resources/loot, personal equipment/progression, guest-targeting AI, readiness/deployment, radio and equipped remote weapons/grapples | In progress: remote visual checks pass; human gameplay/balance and animation parity remain |
| K5 - Persistence/lifecycle | Isolated checkpoints, validated backup import/export, character reconnect, grace/rescue and host pause; reload frees signaling slots | In progress: Chromium/Firefox live reload and simulated host restart pass; external network/tab visibility acceptance remains |
| K6 - Qualification | 26 automated tests, CI soak, four-context real WebRTC checks in Chromium/Firefox and 30 simulated minutes with four clients | In progress: forced TURN, separate networks and a 30-minute real-time human session remain; evidence in docs/validation |

The implementation also provides contributor workflow/source mapping and
automated regression coverage for M1/M2. Their rows below stay In progress while
the changes await review and merge. M3 economy tuning, profiling and M4 offline
dependency work have not been completed by the multiplayer implementation.

## Prioritized backlog

Create an issue and agree on acceptance criteria before starting. Replace the
owner and issue placeholders when claiming work. Independent items can run in
parallel; dependencies are listed explicitly.

| ID | Priority | Work item | Done when | Status | Owner | Issue / PR |
| --- | --- | --- | --- | --- | --- | --- |
| M1-1 | High | Document contributor workflow | Setup, branch/PR workflow, and a manual smoke-test checklist are documented. | In progress | Current implementation | Working tree; review pending |
| M1-2 | High | Map game systems | A source map identifies movement, combat, progression, saves, rendering, and UI boundaries. | In progress | Current implementation | Working tree; review pending |
| M1-3 | High | Establish regression scenarios | Repeatable baseline and upgraded-loadout checks cover movement, combat, purchases, site travel, and save isolation. | In progress | Current implementation | Working tree; review pending |
| M2-1 | High | Agree on module boundaries | A short design defines interfaces, load order, and incremental migration preserving both entry points. Depends on M1-2. | In progress | Current implementation | Working tree; review pending |
| M2-2 | High | Extract one subsystem | One agreed subsystem moves out of the main HTML without gameplay changes; both entry points pass regression checks. Depends on M2-1 and M1-3. | In progress | Current implementation | Working tree; review pending |
| M2-3 | Medium | Add automated checks | A documented command and GitHub Actions check validate the extracted subsystem. Depends on M2-2. | In progress | Current implementation | Working tree; review pending |
| M3-1 | Medium | Review progression and economy | Baseline and max-loadout findings are recorded; agreed balance changes include before/after comparisons. | Proposed | Unassigned | Not created |
| M3-2 | Medium | Improve HUD and input usability | Agreed readability, keyboard navigation, and smaller-screen issues are reproduced and verified after fixes. | Proposed | Unassigned | Not created |
| M3-3 | Medium | Profile demanding gameplay | A repeatable busy-site scenario records frame-time findings and verifies targeted optimizations. | Proposed | Unassigned | Not created |
| M4-1 | Low | Evaluate offline dependencies | A documented decision covers Three.js delivery, licensing, and whether offline play should be supported. | Proposed | Unassigned | Not created |
| M4-2 | Low | Define release checklist | Browser coverage, both entry points, save compatibility, and known limitations are documented. | Proposed | Unassigned | Not created |

### Milestone goals

1. **M1 - Collaboration foundation:** make onboarding and validation repeatable.
2. **M2 - Safer parallel development:** reduce shared-file conflicts incrementally.
3. **M3 - Gameplay and usability:** improve measured or reproduced problems.
4. **M4 - Distribution readiness:** agree on dependency and release expectations.

## Working together

- **Claim work first:** assign yourself to the issue and update its roadmap row
  in a small PR. Unassigned rows are not reservations.
- **Define scope:** include the problem, affected files or systems, acceptance
  criteria, dependencies, and verification plan in each issue.
- **Coordinate shared files:** most gameplay lives in
  `nuclear-sweeper-reactor.html`. Agree on sections each developer owns and
  merge order before making overlapping edits.
- **Keep PRs focused:** use one branch and PR per issue. Separate behavior
  changes from large formatting or extraction changes.
- **Protect both entry points:** verify normal and developer behavior when
  touching shared gameplay; never mix their save or settings keys.
- **Request review:** ask another developer to review when available. Include
  screenshots for UI changes and reproduction steps for gameplay fixes.
- **Close the loop:** link the issue from the PR, record verification results,
  and mark the row **Done** only after implementation is merged.

## Status and maintenance

Use **Proposed**, **Ready**, **In progress**, **Blocked**, and **Done**.
**Ready** means scope and acceptance criteria are agreed and dependencies are
resolved. Set **In progress** when implementation starts. For **Blocked**, link
the blocking issue and explain what is needed.

Review priorities before starting a milestone or substantial new feature.
Propose new work in an issue instead of silently expanding an active task.
Keep completed items until the milestone closes, then summarize them here or
link a release summary so contributors can understand prior decisions.
