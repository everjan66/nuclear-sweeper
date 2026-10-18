# Private browser co-op

Implementation status: October 18, 2026. Local endurance and Chromium/Firefox
browser checks pass; external network qualification remains open. The design is in
[MULTIPLAYER_PLAN.md](MULTIPLAYER_PLAN.md).

## Running and playing

Use Node.js 22+ and `npm start`; no package installation or build step is needed.
The server serves the game and signaling API on `http://localhost:8787`.
Create a room, copy its private invitation, and join from another tab/browser.
Normal and developer rooms reject each other's clients. Use the same browser
profile and origin when reconnecting to preserve your character identity.

Only the host saves the team world. It checkpoints periodically and on important
transactions, rescue, deployment and page exit. Restart returns saved characters
to shelter, deposits carried dust once, discards in-flight projectiles and awards
no offline refinery income. Backups include equipment, shared resources, cleaned
dust, entities, progression and character reconnect credentials. Import validates
the complete checkpoint before replacing the selected co-op slot. Solo imports
and exports remain in the solo settings menu.

A dropped guest has neutral input, remains vulnerable for ten seconds, then is
rescued once. Its slot stays reserved for sixty seconds. Returning clients can
reclaim the same character with their private token. A host departure ends the
live session; resume the host checkpoint and distribute a new invitation.

## Architecture

- `js/core/definitions.js`: shared stats, weapons, economy definitions and radio.
- `js/core/map.js`: seeded, DOM-free geometry and dust generation.
- `js/core/movement.js`: fixed 64 Hz movement with explicit world/player/input.
- `js/game/simulation.js`: authoritative co-op combat, AI, collections, refinery,
  purchases, progression, readiness, deployment and checkpoint validation.
- `js/net/protocol.js`: protocol version, input validation and invitation format.
- `js/net/transport.js`: host-star WebRTC, reliable and unreliable channels,
  bounded queues, chunked snapshots, signaling and connection diagnostics.
- `js/net/session.js`: identity binding, input prediction/replay, reconciliation,
  snapshots, interpolation, transactions, reconnect grace and pause lifecycle.
- `js/storage/coop.js`: isolated checkpoints and validated import.
- `js/ui/coop.js`: mode selection, invitations, roster, backup UI and diagnostics.
- `js/ui/remote-players.js`: equipped remote weapons, attachments, mastery finishes,
  reload/muzzle presentation, grapple ropes and avatar resource cleanup.
- `services/signaling/server.cjs`: ephemeral private room discovery and ICE config.

Load order is core definitions/map/movement, simulation, protocol/transport,
storage/session, remote-player/co-op UI, then the existing HTML render shell. Scripts expose
`NSR` interfaces; DOM-free modules also support CommonJS for tests.

The host runs 64 Hz simulation; guests send redundant sequenced input around
32 Hz and receive dynamic frames around 20 Hz. Movement predicts locally and
replays unacknowledged inputs. Other players and enemies interpolate behind the
latest frames. Gameplay authority stays on the host: damage, pickups, funds,
upgrades, rescue and deployment never depend on guest-rendered positions.
Reliable messages carry initial/transition snapshots, absolute dust changes,
events and idempotent transactions. Session and generation IDs reject obsolete
gameplay messages after reconnect or deployment.

Wire protocol version 2 packs input controls into validated bit masks and sends
only render-relevant remote pose fields. Hosts and guests must reload together
and create a fresh invitation when upgrading from version 1. Co-op checkpoint
format version 1 remains unchanged. Exiting/reloading a page sends an authenticated
keepalive leave request to free the signaling slot promptly.

The signaling implementation deliberately uses HTTP REST and long polling,
instead of the proposed WebSocket service, to keep setup dependency-free.
Gameplay goes over WebRTC. Losing signaling does not destroy established peer
connections, but new joins need the service. Rooms and invitations are ephemeral
and expire; checkpoints are stored in the host browser, not on this server.

Shared map and movement are integrated into solo. Solo combat/economy still use
the legacy HTML shell; a complete single-simulation solo migration remains a K1
follow-up. Co-op AI uses its own shared targeting/pathing implementation and
needs further gameplay parity/balance review. Remote avatars show equipped weapon
dimensions, attachments, mastery finish, reload pose, confirmed muzzle flashes and
grapple ropes. Detailed animation and finish-art parity still need visual review.

## Hosting on the internet

Serve the game and API on one HTTPS origin behind a reverse proxy. Forward all
paths to the Node process and allow long-poll requests to remain open for at
least 25 seconds. The Node server uses HTTP internally; terminate TLS at the
proxy. Set these environment variables in your process manager:

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | HTTP listen port | `8787` |
| `BIND` | Listen address | `127.0.0.1` |
| `ALLOWED_ORIGIN` | Exact public game origin allowed by signaling | Unrestricted origins for local development |
| `STUN_URL` | STUN endpoint | `stun:stun.l.google.com:19302` |
| `TURN_URLS` | Comma-separated TURN/TURNS URLs | No relay |
| `TURN_SECRET` | TURN shared authentication secret | No relay |

Configure coturn or an equivalent relay to use the same shared secret with
time-limited REST credentials. The API issues one-hour HMAC credentials to room
members; the static client never receives the shared secret. Provide UDP and TCP
relay endpoints, including a TLS endpoint where needed, and configure the
relay's public address and firewall port range. Set `ALLOWED_ORIGIN` for public
hosting. Keep service secrets outside the public directory. Static serving uses
an explicit allowlist. Proxy-level request limits are appropriate for deployment.

The expedition diagnostics show ping, direct/relay path and queued bytes. Use
**Connection testing / Force TURN relay** before creating or joining a room to
qualify the relay. Without configured TURN this mode fails with an explanation;
a successful direct local connection does not establish internet readiness.

## Validation and release gates

`npm test` covers deterministic maps/movement, collection conservation, one-time
loot/kill attribution, economy transaction idempotency, personal/shared upgrades,
guest-targeting AI, deployment authority, save restart/import isolation, radio
progress, disconnect rescue, input validation and signaling authorization/capacity.
Session tests use a controlled clock/network with 150 ms RTT and 2% packet loss
to check prediction convergence, input expiry, transactions, pause and reconnect.
GitHub Actions runs this suite and a two-minute simulated soak on Node 24.

October 18 validation: 26 automated tests pass. Four independent browser contexts
passed real localhost WebRTC checks in Chromium 154.0.8037.92 and Playwright
Firefox 157.0: join, hotbar selection, movement, remote weapons/attachments/finish,
grapple rope, host pause, deployment, guest reload/reconnect and avatar disposal.
Both also checked the narrow mode menu, normal solo save round trip and developer
iframe/max-loadout save isolation. The browser harness drives the simulation with
timers and invokes rendering explicitly to work with software WebGL; it does not
measure sustained rendering performance.

The four-client deterministic soak completed 2,075 simulated seconds with 150 ms
RTT, +/-45 ms one-way jitter and 2% unreliable-message loss: 15 purchases,
15 deployments, 14 disconnect/rescue/reconnect cycles and one host restart, with
no validation errors. Checkpoints are reloaded every simulated minute. Input and
remote-frame packing reduced aggregate JSON payload traffic by about 41%, from
3.33 to 1.95 Mbps in the same scenario. These are simulated payload totals across
all clients, excluding WebRTC/IP overhead, and do not qualify an internet link.
The scenario uses scripted movement/fire and fixture teleports, funding and
clearance to exercise lifecycle transitions; it is not a human gameplay/balance test.

Reproduce with `npm run test:soak` (30 simulated minutes), or
`node scripts/coop-soak.cjs 2` for the shorter CI run. For browser checks, install
Python Playwright (`python -m pip install playwright==1.64.0`), install its browsers
(`python -m playwright install chromium firefox`), start the game server, then run
`python scripts/browser-smoke.py --browser chromium` and repeat with `--browser firefox`.
`--executable` can select an existing compatible browser executable. The game
itself still has no added runtime dependencies. Raw validation results are in
[docs/validation/2026-10-18-coop-release.json](docs/validation/2026-10-18-coop-release.json).

The full release qualification still needs:

- Run four human players for at least 30 real-time minutes with repeated collecting, shooting,
  loot races, purchases, rescues and site deployments; compare team/player state.
- Use separate home/mobile networks and a forced TURN connection. Verify UDP,
  TCP/TLS fallback, service outage and recovery, and guest reconnect after loss.
- Review full parkour/combat/gear parity and animation in both browsers with
  baseline and max loadouts; check real tab visibility pause/resume behavior.
- Measure bandwidth/frame time in a busy four-player site and check remote
  movement/parkour presentation under jitter, burst loss and backpressure.
- Recheck solo save compatibility, progression and movement against MOVEMENT.md.

Until these pass, K6 and public release readiness stay open.
