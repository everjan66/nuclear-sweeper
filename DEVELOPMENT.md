# Developer version

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
