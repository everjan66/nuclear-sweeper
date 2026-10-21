# Developer version

For multiplayer setup, source boundaries and outstanding release checks, see
[MULTIPLAYER.md](MULTIPLAYER.md). Run `npm start` for both the static game and
signaling service, and `npm test` for automated checks. Keep `js/` next to the
HTML entries. Normal/developer solo continue to work from local files.

The controls below describe solo. In developer co-op, F2 opens the expedition
menu. Only the host receives co-op controls for funding, maximum equipment,
cleanup, resupply and temporary assists. Guest clients cannot invoke host tools.
Co-op local menus neutralize input; the host visibility pause stops the shared
simulation and refinery. Co-op saves use `nsr_coop_v1` and `nsr_coop_dev_v1`,
with reconnect identities stored under each key's `_identities` suffix.

## Regression workflow

Before a change, run the automated suite and note the affected source boundaries
listed in MULTIPLAYER.md. After a shared movement/map change, check both HTML
entries: baseline walking, jumping, crouch/slide, wall movement, vault/mantle,
grapple and zipline; repeat with upgraded boots and movement modules. Fire,
reload, switch weapons, buy gear/weapon/attachment upgrades, collect dust and
loot, deposit and refine, get rescued and deploy. Export/reload/import a save.
Confirm normal/developer and solo/co-op saves never overwrite each other.

For network changes, add a second browser client, test late join and reconnect,
compare transactions and deployment, and test host pause/resume. Check the
diagnostics and console. Complete the external-network release checklist before
describing a local smoke test as multiplayer release acceptance.

Contributors should follow the issue/branch/review workflow in roadmap.md and
include relevant validation and known limitations in the PR description. Mark
roadmap rows Done only after merge.

Open `nuclear-sweeper-dev.html` beside `nuclear-sweeper-reactor.html` and
`nuclear-sweeper-dev.js`. The developer entry uses the same game code, so movement,
combat, purchases and progression match the normal build. A static web server
also works. Three.js needs an internet connection, as in the normal game.

Press **F2**, or click **DEV TOOLS**, to open the panel anywhere. **F2 / Escape**
closes it. Gameplay pauses while the panel is open; the refinery keeps running.
If the shelter or settings were already open, close that menu too to resume play.
After closing the menus, click **CLICK TO RESUME** to capture the mouse again.

## Meltdown Sweeper regression checks

`tests/sweeper-boss.test.cjs` covers the 35% selection boundary, legacy saves,
cleanup plus dodge gating, nozzle collision and per-player hit deduplication,
safe-pad and jumping immunity, dust bombs, shock rings, phase caps, exactly-once
victory, increased damage across all phases, grounded-slide pressure-sweep
immunity (not stationary crouching or jumping), in-flight checkpoint restoration,
and host/guest convergence under loss.
Run `npm test`. The existing Playwright release smoke also renders the new model
in normal solo and the developer iframe, checks the warning lane and detached
nozzle position, opens the core shutters, and round-trips a phase-two save.

For a manual check, fully clean a site; the Sweeper replaces the Sovereign in
35% of new encounters. Confirm the black canister, red dome, hose nose, broad
nozzle, and green cracks. Sweep all patches: the shield must remain until a
nozzle misses. Sidestep the orange lane, shoot during the short opening, dodge
dust bombs and remove their new patches, and jump the shock ring. Finish all
three phases, confirm one reward, then deploy. Repeat with a co-op guest, check
that a teammate hit blocks exposure, and reload while the nozzle is flying.
In phase two/three, watch for the cyan sweep warning: build speed and slide as
it reaches you. Verify standing, crouching in place and jumping take damage,
the green pad is safe, and saving/reloading preserves an expanding sweep.

## Traversal-room regression checks

`tests/rooms.test.cjs` checks all 100 seeded sites for three enlarged rooms,
double footprints and deterministic generation; it also simulates baseline
platform ascents, high-ceiling grapples, laser timing/height/damage and old/new
co-op checkpoint restoration. Layout versions 0 and 1 retain their original
seeded geometry and dust; new games and deployments use layout version 2.

In both HTML entries, start fresh or deploy, visit the Gantry Exchange, Laser
Foundry and Relay Chamber, and compare jumping/mantling the stepping blocks
with grappling directly to the platforms/ceiling. Confirm amber warning, red
contact damage, safe off phases, end-runs and floor-level evasion of the upper
beam. Repeat with a co-op guest and invincibility enabled/disabled. Reload an
older save before deploying to confirm its existing dust stays in place.

## Available controls

- Fund the exact cost of every remaining purchase, edit credits/scrap/rare parts,
  open the real shelter shop, buy individual levels, or buy a fully upgraded loadout.
- Purchase all weapons, attachments and movement modules; equip weapons and
  toggle individual attachments. Reset equipment to compare baseline stats.
- Travel directly to named sites 1-4 or any site from 1-100, including previous,
  next and reload. Travel regenerates the site and resets dust, radio progress,
  vault and collectible flags; equipment and resources carry over.
- Teleport onto safe ground near the shelter, reactor, depots, terminal, island,
  vault or any room. Opening the vault exposes its normal collectible loot.
- Fill/deposit the tank, add refinery dust, process 60 seconds of refining, set
  cleanup to 97% to enable deployment, or clean the entire site. Reload the site
  before lowering cleanup again. Replay radio messages by resetting their cursor.
- Heal/resupply, spawn a chosen enemy, remove enemies, kill them for normal loot,
  and test death/rescue. Kill/death actions resolve when gameplay resumes.
- Toggle invincibility, infinite ammo, or frozen enemies/automatic spawns. All
  assists start off and are not persisted across page reloads.

## Shrieker flight checks

In developer solo, choose **Shrieker** in the enemy selector and spawn nearby.
Test pursuit onto raised walkways and floating platforms, then return to ground
level. Check that it flies around full-height walls, cannot hit through platforms
or from a different elevation, and stays outside the shelter. Shoot the body and
head at their visible height. Repeat with a co-op guest on high ground; verify
the host and guest see the same altitude and that checkpoint reload preserves it.
Existing four-enemy progress records migrate without losing kills.
The Weapons overview lists 5/15/40 Shrieker kills for Gold/Platin/Polychrome;
Shrieker hunter achievements unlock at 10/50/200 lifetime kills in solo and co-op.

## Dust Sovereign encounter

Sweep **every** dust tile on a site (not the existing 97% early-deployment
threshold) to teleport into the Dust Sovereign arena. The clear floor is 54 by
38 meters, roughly six average site rooms, with a large, crowned reactor boss.
Entering deposits carried dust without healing the player or co-op team.

The boss shields while enemies or dust remain and regenerates while dusty.
Clear the mandatory enemy wave and all highlighted patches to open a
10/9/8-second damage window. Health gates at two-thirds and
one-third start the next phase; regeneration never undoes a completed phase.
Phase one uses telegraphed blasts; phase two uses double blasts; phase three
adds expanding shock rings that can be jumped. Orange circles warn of blasts,
and green beacons plus minimap dots locate remaining dust. Each wave fits a
baseline tank; use the green shelter/depot to deposit only. There is no passive,
pad, or upgrade healing during combat, and the pad is not safe from attacks.
Reserve reloads are unlimited until victory, including at zero saved reserves;
magazines and reload time still apply. Boss health, wave size and enemy health
scale with the strongest unlocked weapon upgrades and party strength. Attacks
continue during exposed windows and accelerate in later phases. A rescue resets
the whole team's encounter to phase one with fresh health, rather than preserving
damage dealt. Reload/rehost preserves injured health and surviving reinforcements.

Victory awards 1,000 + 250 per site credits and three parts, once. Deployment
is blocked during the encounter and available after victory. Boss state and
arena dust survive save/load and co-op reconnect. Normal 97% early deployment
remains available before entering the arena, so existing progression is intact.

Developer smoke test: choose **Clean entire site**, close the tools and shelter,
and resume to trigger the teleport. Repeat cleanup during each phase to expose
the core quickly. Travel/reload a site to leave the arena and reset the boss.
Automated encounter and co-op regressions run with the existing `npm test`.
For each phase, check the magenta floor rings, vertical beacons and minimap
squares during the 1.5-second reinforcement countdown. Enemies must arrive at
those marked positions, and the core must stay shielded until they are cleared.
Pause or reload during the countdown: it must resume, not restart or duplicate
the wave. A co-op guest should see the same marked positions as the host.

## Save isolation

Normal progress uses `nsr1` and normal settings use `nsr_cfg`.
Developer progress uses `nsr1_dev` and developer settings use `nsr_cfg_dev`.
The developer version never imports or overwrites the normal save. Resetting
developer progress requires a second click and affects only the developer slot.
Keep the normal and developer pages on the same origin when comparing them.

The normal entry does not load the developer interface. Developer mode can also
be opened directly with `nuclear-sweeper-reactor.html?dev=1`.
