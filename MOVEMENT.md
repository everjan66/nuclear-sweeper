# Source-style movement

The standalone build adapts the horizontal movement algorithms from
https://github.com/perilouswithadollarsign/cstrike15_src:

- `game/shared/gamemovement.cpp`: `Friction`, `Accelerate`, and `AirAccelerate`.
- `game/shared/cstrike15/cs_gamemovement.cpp`: ground acceleration scaling.
- `game/shared/movevars_shared.cpp`: acceleration and friction defaults.

This is a JavaScript adaptation, not a full Source physics/SDK port. Existing
collision handling, gravity, jump height, coyote time, jump buffering, boots,
terrain modifiers, slides, rolls, wallruns, vaults, grapples, and dashes remain
game-specific. Weapon-specific movement penalties are not added.

## Tuning

`MOVE` near the top of `nuclear-sweeper-reactor.html` holds the settings:

| Setting | Value | Meaning |
| --- | --- | --- |
| `tick` | `1 / 64` | Fixed gameplay timestep, independent of rendering |
| `groundAccel` | `10` | Snappier ground acceleration coefficient |
| `airAccel` | `12` | Air acceleration coefficient |
| `friction` | `5.2` | Ground friction coefficient |
| `stopSpeed` | `80 * 7.2 / 250` | Low-speed friction threshold |
| `airWishCap` | `30 * 7.2 / 250` | Maximum velocity projection along air input |
| `slideMinSpeed` | `3.5` | Minimum horizontal speed to enter a slide |
| `slideEndSpeed` | `2.5` | Speed below which a slide ends |
| `slideDrag` | `2.4` | Slide speed lost per second |
| `slideTurnRate` | `1.2` | Maximum slide steering rate in radians per second |

Friction thresholds and the air cap retain the original conversion from Source's
250-unit reference speed to 7.2 game units. Ground speed is now tuned above that
baseline: 9 m/s (up from 7.2), plus 0.45 m/s per boots level. Boots still increase
wish speed; the air projection cap stays fixed. Air acceleration uses the uncapped wish speed for acceleration
and the capped speed only for the directional projection limit.

Ground movement now uses friction followed by directional acceleration, rather
than velocity interpolation and a seven-second forward speed ramp. All movement
directions share a maximum speed, and diagonal input is normalized. A jump is
processed before ground friction and no longer adds an automatic horizontal kick.
There is no horizontal air drag or total-speed clamp during normal air movement.
Landing penalties for large falls and special parkour movement still apply.

## Slides and slide jumps

Hold Shift or C while moving fast enough to slide in your current travel
direction, including sideways or backwards. Movement input steers the slide
smoothly, without locking the camera to its direction. Slides coast with reduced
drag and do not add a free speed boost.

Press Space during a slide to jump immediately with the current horizontal
momentum intact. Releasing crouch also ends the slide immediately; neither exit
halves your speed. Normal ground friction still applies when ending on the ground.
After cancelling a slide while holding crouch, release and press crouch again to
re-arm it. This prevents an unwanted automatic re-slide when a slide jump lands.
Walking off a ledge also preserves momentum. Slide speed respects speed lost to
collisions rather than restoring it on the next tick.

## Bidirectional ziplines

Grab a nearby zipline with the use key (E by default). Your initial velocity
along the cable chooses the travel direction, including uphill. If you are not
moving along it, your facing direction chooses instead; facing perpendicular
to the cable defaults to travelling toward the farther endpoint. The direction
stays fixed while riding, so looking around does not reverse your travel.

Both ends release automatically and preserve horizontal exit momentum. Jump to
leave early with an upward boost, or crouch to drop off. A short re-grab cooldown
applies in either direction.

## Quick feel check

1. Hold W: reach full ground speed promptly. Release to stop; press S to counter-strafe.
2. Run and jump. Release W, hold A or D, and smoothly turn the mouse toward that
   strafe direction. Momentum carries through the jump while the strafe changes it.
3. Jump without directional input: horizontal momentum should remain unchanged
   until a collision, landing, or special movement mechanic intervenes.
4. Check diagonal movement, crouching, terrain speed modifiers, slides, vaults,
   wallruns, grapple release, and air dashes on the existing parkour routes.
5. Run, hold Shift or C, then press Space: leave the slide immediately and carry
   its speed into the jump. Release crouch and press it again to chain another slide.
6. Slide sideways or backwards, steer with movement keys, and release crouch:
   steering should be smooth and slide release should not abruptly halve speed.
7. Grab a zipline while moving toward either endpoint, including uphill. Look
   around while riding, then check automatic release, jumping, and dropping off
   in both directions. At rest, face along the cable to choose a direction.

Browser validation covers ground speed, stopping, counter-strafing, directional
air caps, momentum preservation, normalized diagonal input, jump ordering, slide
integration, and fixed-step simulation at different rendering rates.
