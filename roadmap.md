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

October 19, 2026: the private co-op implementation is available in PR #19.
See [MULTIPLAYER.md](MULTIPLAYER.md) for setup, source map and validation;
[MULTIPLAYER_PLAN.md](MULTIPLAYER_PLAN.md) remains the design reference.
Rows remain In progress until review/merge and the listed acceptance checks.

| Stage | Implementation | Status / remaining acceptance |
| --- | --- | --- |
| K1 - Shared simulation | DOM-free maps, movement and co-op simulation with explicit players; solo uses shared map/movement | In progress: solo combat/economy migration and gameplay parity remain in #20 |
| K2 - Connections | Four-slot private signaling, host-star WebRTC, invitations, version/dev checks, ICE configuration | In progress: deployed TURN and separate-network checks remain in #21 |
| K3 - Synchronization | Fixed host ticks, prediction/replay, snapshots, dust updates, interpolation, confirmed transactions; packed wire v2 and bounded UTF-8 queues | In progress: simulated latency/loss soak and queue overflow/drain tests pass; payload reduced 41%; real-link congestion qualification remains |
| K4 - Co-op gameplay | Shared resources/loot, personal equipment/progression, guest-targeting AI, readiness/deployment, radio and equipped remote weapons/grapples | In progress: remote visual checks pass; human gameplay/balance and animation parity remain |
| K5 - Persistence/lifecycle | Isolated checkpoints, validated backup import/export, character reconnect, grace/rescue and host pause; reload frees signaling slots | In progress: Chromium/Firefox signaling process restart, checkpoint rehost and identity recovery pass; external network/tab suspension acceptance remains in #21 |
| K6 - Qualification | 35 automated tests, CI soak, four-context real WebRTC checks in Chromium/Firefox and 30 simulated minutes with four clients | In progress: forced TURN, separate networks and a 30-minute real-time human session remain; evidence in docs/validation |

PR #19 delivers an experimental private co-op foundation. Issues #20-#22 track
remaining parity, public deployment qualification and performance/balance work.
Merge of the foundation does not mark the full multiplayer plan complete.

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
| B1 | Medium | Add alternate Meltdown Sweeper boss | Chance selection, cleanup/dodge gates, diverse attacks, reference-inspired model, saves and both entry points pass solo/co-op checks. | In progress | everjan66 | #30; PR review pending |
| M1-1 | High | Document contributor workflow | Setup, branch/PR workflow, and a manual smoke-test checklist are documented. | In progress | Current implementation | PR #19; review pending |
| M1-2 | High | Map game systems | A source map identifies movement, combat, progression, saves, rendering, and UI boundaries. | In progress | Current implementation | PR #19; review pending |
| M1-3 | High | Establish regression scenarios | Repeatable baseline and upgraded-loadout checks cover movement, combat, purchases, site travel, and save isolation. | In progress | Current implementation | PR #19; review pending |
| M2-1 | High | Agree on module boundaries | A short design defines interfaces, load order, and incremental migration preserving both entry points. Depends on M1-2. | In progress | Current implementation | PR #19; review pending |
| M2-2 | High | Extract one subsystem | One agreed subsystem moves out of the main HTML without gameplay changes; both entry points pass regression checks. Depends on M2-1 and M1-3. | In progress | Current implementation | PR #19; review pending |
| M2-3 | Medium | Add automated checks | A documented command and GitHub Actions check validate the extracted subsystem. Depends on M2-2. | In progress | Current implementation | PR #19; review pending |
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

## Simulation timing audit follow-up

- #45 — Bounded elapsed-time catch-up independent of rendering: In progress; 173 integrated tests passed across solo/host/guest callback rates, pause/resume, input edges and long stalls. Implementation in PR #51; final browser revalidation pending merge. At most 250 ms (16 fixed ticks) is consumed per callback; excess stall time is deliberately discarded.

## Gameplay design follow-ups from the audit

These are scoped proposals, not completed gameplay changes. Existing newer boss mechanics remain the baseline for playtests.

- #47 — Measure progression income and upgrade costs before economy tuning; complements performance/playtest issue #22.
- #48 — Prototype explicit boss entry, one room-cleanup consequence and a traversal reward; evaluate against current automatic entry.
- #49 — Define assist/contribution progression and prioritize solo/co-op feedback parity; complements shared simulation migration #20.
## Rendering lifetime audit follow-up

- #44 — Dispose world-owned render resources and removed vault doors: Done (merged in PR #50); 160 tests and Chromium four-client smoke passed, including stable geometry counts across ordinary/boss rebuilds. Shared geometry/material/texture assets are retained explicitly. 
## Loot and visibility audit follow-up

- #43 — Value-preserving loot stacks, legacy checkpoint recovery and complete projectile/drop rendering: Done (merged in PR #46); 162 tests and Chromium four-client regression passed.  Nearby ordinary drops merge; at capacity they merge into the nearest compatible stack, while seven rare markers remain independent.
## Combat audit follow-up

- #41 — Co-op fractional fire cadence and solo late-site mastery targets: Done (merged in PR #42); cadence/idle/menu/reload and sites 2–100 spawn regressions covered. Human balance feedback on the explicit enemy mix remains welcome.
## Ceiling lookup audit follow-up

- #39 — Cached ceiling heights for collision/ray queries: Done (merged in PR #40); all map versions and sites match reference lookups. Local four-player benchmark median improved from 0.31–0.35 ms to 0.15–0.20 ms per tick.  run `node scripts/benchmark-ceilings.cjs` to reproduce (not a GPU/FPS benchmark).
## Signaling audit follow-up

- #37 — Queue-safe room expiry/leave and atomic join admission: Done (merged in PR #38); regression tests cover full queues and unaffected rooms. 
## October code audit fixes

- #35 - Solo checkpoint retention/recovery and boss accounting: Done (merged in PR #36). Rejected-save preservation, quota failures, and boss save/reload verified.
