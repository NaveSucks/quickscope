# Validation ledger

This file distinguishes implementation from acceptance evidence.

- Node 24 resource-limited container: TypeScript check and production build pass.
- 27 unit/integration and route tests passed, including sockets, capacity races,
  crouch collision, vertical routes and weapon hit-zone damage.
- npm audit after patched dependencies: zero advisories.
- Authenticated client: ~957KB gzip, 2.72MB raw; gate ~3KB raw.
- Gate has no engine/map/WASM/audio imports; server guards every game-prefix request.

Chromium CI passed authentication, two-client initialization, an actual winning
shot and replay. The impairment proxy covered 50/100/150ms message delay, jitter
and deterministic disposable-message loss. Observed p95 reconciliation stayed
below 0.3m in the passing run. This models application-message impairment rather
than real IP packet loss.

Commit 618dce6 completed a 30-minute, 18-socket load run: max sampled p95
simulation work 1.302ms, peak sampled RSS 162.46MiB, zero backlog events.

The human gameplay preview was approved on 2026-09-11. Production runs commit
`c76ab24e670e2875126c1eef0fbb31b8471a4fb0` using immutable manifest digest
`sha256:f1161da71c2c2eca8c5bfd5f250c3b35f2b217b9c701aa1c0d4740c48cf0cf97`.
External HTTPS authentication, gated bundle delivery, no-store responses,
authenticated WebSocket access, health checks, and neighboring routes passed.
First-release rollback artifacts are retained outside Git; an actual rollback
was not performed after the successful release.

Pending: detailed original Highrise visual/route comparison, real integrated-GPU
laptop 60FPS/1080p measurement, Firefox/Edge/Safari checks, and OS-level network
impairment testing.

Known limitations to resolve before declaring the planned v1 complete:

- Greybox dimensions and route fidelity are estimates awaiting reference review.
- Basic procedural animation/audio passed the initial human preview but remain
  open to feel and presentation iteration.
- Replay records accepted hit/target pose; server holds players during aftermath.
- No actual GPU performance measurements are implied by headless browser tests.
