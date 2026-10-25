# Dust rendering measurements

Hardware: Ryzen 5 2600 (6 cores / 12 threads), RTX 2060, 32 GB RAM.
Windows reports a 1920x1080 display at 239 Hz. Measurements used the T3 native
preview, Chromium 152 / Electron 44, hardware WebGL via NVIDIA D3D11, with a
1920x1080 drawing buffer. This is not a measurement of the user's game browser.

The fixed fixture uses site 20, 28 enemies, the first large room, yaw 0.6,
pitch 0, and a maximum detector. Simulation is paused. Each case performs
20 warmup draws and 120 measured draws, repeated three times. The moving case
changes the viewpoint in a six-unit circle. The baseline reproduces the former
dust-update algorithm inside the same draw function. The harness intercepts
WebGL bufferSubData to count bytes for the two dust attributes only.

| Case | Baseline median draw CPU | Optimized median draw CPU | Dust upload bytes/frame |
| --- | --- | --- | --- |
| Maximum detector, stationary | 1.2-1.8 ms | 0.4-0.6 ms | 273,600 -> 0 |
| Maximum detector, moving | 1.2-1.9 ms | 0.5-0.8 ms | 273,600 -> 8,359 |
| Base detector, moving | 0.5-0.6 ms | 0.5 ms | 273,600 -> 1,406 |

Sub-millisecond values are noisy and zero means below timer resolution, not
zero execution time. CPU render submission excludes display scheduling,
compositing, active simulation, and actual GPU completion. These results do
not establish sustained gameplay FPS or explain every reported drop to 70 FPS.
The separate exploratory GPU timer query in the site-20 scene measured about
0.38 ms median and 1.19 ms p95 over 20 draws before this change.

Raw runs are in the adjacent JSON files. Base-gear CPU improvements were small;
the largest measured benefit is with a highly upgraded detector.

To reproduce, serve the repository using `python -m http.server 8791`, open
`/nuclear-sweeper-reactor.html`, start solo and pause. In the developer console:

```js
S.sector = 20;
genMap(20);
const room = R.find(r => r.large);
p.x = (room.cx + .5) * TS;
p.z = (room.cz + .5) * TS;
p.yaw = .6;
p.pit = 0;
rend.setSize(1920, 1080, false);
cam3.aspect = 16 / 9;
await import('/scripts/benchmark-dust-render.js');
await NSR.DustBenchmark.run();
await NSR.DustBenchmark.run({detectorLevel: 0});
```

Use an isolated browser profile: fixture setup changes the current solo world.
The benchmark restores its temporary position and detector-level changes.
The signaling server does not serve scripts/, so use the static server above.

Correctness validation: 177 Node tests and the Chromium four-client browser
smoke passed. Coverage includes unchanged frames, partial ranges, duplicate
dirty cells, range shrink, teleport, map/palette rebuilds, and GPU attribute
version stability after edits. Moving out of range also clears stale bright
cells, including teleports and detector downgrades.
