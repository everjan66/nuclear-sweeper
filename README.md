
# Nuclear Sweeper

## HUD and shelter navigation

The in-game readout groups mission progress, movement, and navigation into
separate panels. The shelter uses category buttons for the overview, gear,
station, weapons, licenses, mastery, achievements, workshop, movement modules,
and radio log. Settings separates sound, aiming, and key bindings.

Menus do not scroll. Use Previous / Next when a category needs more than one
page; page sizes adapt to the available screen height. Resources and exit
actions remain visible, and purchases keep the current category and page.
Category and page buttons also work with Tab and Enter / Space.

For a manual UI check, visit every category on desktop, portrait, and landscape
screens. Page through achievements, mastery, and key bindings; buy an upgrade,
equip an attachment, rebind a key, and resize with a menu open. Verify that
content stays reachable without scrolling and that leaving / settings still work.

## Progression

Open `nuclear-sweeper-reactor.html` in a browser to play. The shelter shows
weapon licenses, per-weapon mastery requirements, and lifetime achievements.

### Weapon licenses

Weapon classes unlock automatically through kills, not credits:

| Unlock | Kills with the previous class |
| --- | --- |
| MP7 and SMG-11 (machine pistols) | 25 pistol kills |
| 416-C and R4-C (assault rifles) | 60 machine-pistol kills |
| Breaker (shotgun) | 90 assault-rifle kills |
| Vector DMR (sniper / DMR) | 60 shotgun kills |

Variants contribute to a shared class total. These starting values target a
short introductory pistol phase and longer practice with automatic weapons;
the shotgun requirement is lower because of its slower firing and reloads.
They are initial tuning values, not a substitute for extended playtesting.
Credits still buy station and weapon-stat upgrades.

### Weapon mastery

Each weapon starts at Basic. All requirements in a row must be met with that
specific weapon; progress is cumulative and is never spent or reset on promotion.

| Finish | Total kills | Glowers | Spitters | Brutes | Gunners |
| --- | --- | --- | --- | --- | --- |
| Tier 1: Gold | 50 | 20 | 5 | 0 | 0 |
| Tier 2: Platin | 150 | 40 | 25 | 10 | 10 |
| Tier 3: Polychrome | 400 | 100 | 60 | 40 | 40 |

Mastery changes the weapon finish and weapon-slot border, not damage. Polychrome
cycles through colors. Weapon slots also show mastery and kill counts on hover.
Only the weapon delivering the killing hit receives credit. Shotgun pellets
cannot count the same enemy twice; despawning enemies never awards kills.

### Achievements and saves

- Lifetime dust removed: 500, 2,500, 10,000, and 50,000 units.
- Each enemy type: 10, 50, and 200 kills (16 achievements in total).
- Dust counts at collection, not delivery or refining; losing tank contents
  does not undo cleanup progress or count dust a second time.
- Progress survives death, site changes, and reloads. Reset save clears it.
- Existing saves retain purchased weapons. New statistics start at zero because
  old saves did not record lifetime dust or per-weapon/per-enemy kills.

### Validation

Browser checks cover fresh and legacy saves, exact unlock boundaries, combined
class counts, every mastery total/type gate, duplicate kill protection,
achievement deduplication, save/load round trips, and removal of credit unlocks.
For a manual check, inspect the shelter progress cards, earn kills with each
class, and verify that newly unlocked weapons can be selected with keys 1–7.

## Heavy-weapon collateral

Heavy rounds can hit enemies lined up behind the first target. Walls and other
solid cover still stop shots; enemies are hit at most once per round or pellet.

| Weapon | Maximum targets per round / pellet | Damage retained per penetration |
| --- | --- | --- |
| Desert Eagle, 416-C, R4-C | 2 | 60% |
| Breaker | 2 per pellet | 50% |
| Vector DMR | 3 | 75% |

MP7 and SMG-11 rounds stop at the first enemy. The Vector DMR also deals 2.5x
damage to large enemies (50 base body damage and 200 base brute headshot damage,
before upgrades, attachments, and penetration falloff).

See `MOVEMENT.md` for movement tuning and zipline controls.

## Room variety

New sites mix cargo storage, turbine halls, sample labs, service archives,
collapsed works, and open transfer atriums. Each has its own layout, floor
markings, and overhead sign. Layouts are seeded per site, with clear central
routes and the existing platforms, depots, reactor, shelter, and coolant pool.

Existing saves retain their current site's layout and cleanup progress. The new
room designs appear when deploying to the next site (or starting a fresh save).
