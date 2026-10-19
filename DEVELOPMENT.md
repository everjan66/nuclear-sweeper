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

## Save isolation

Normal progress uses `nsr1` and normal settings use `nsr_cfg`.
Developer progress uses `nsr1_dev` and developer settings use `nsr_cfg_dev`.
The developer version never imports or overwrites the normal save. Resetting
developer progress requires a second click and affects only the developer slot.
Keep the normal and developer pages on the same origin when comparing them.

The normal entry does not load the developer interface. Developer mode can also
be opened directly with `nuclear-sweeper-reactor.html?dev=1`.
