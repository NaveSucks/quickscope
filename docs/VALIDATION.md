# Validation ledger

This file distinguishes implementation from acceptance evidence.

- Node 24 resource-limited container: TypeScript check and production build pass.
- 15 unit/integration tests passed, including sockets, capacity races and crouch collision.
- npm audit after patched dependencies: zero advisories.
- Authenticated client: ~957KB gzip, 2.72MB raw; gate ~3KB raw.
- Gate has no engine/map/WASM/audio imports; server guards every game-prefix request.

First Chromium CI passed authentication, two-client initialization and replay.
Initial commit 27b5cd6 completed a 30-minute, 18-socket load run: max sampled
p95 simulation work 0.888ms, peak sampled RSS 180.72MiB, zero backlog events.
This predates the revised map/crouch/replay code; a fresh run is required.

Pending: stronger impaired-network browser test, revised-build load results,
50–150ms RTT/jitter/loss two-browser gameplay, original Highrise visual/route
comparison, manual traversal and weapon feel review, real integrated-GPU laptop
60FPS/1080p measurement, Firefox/Edge/Safari checks, production secret setup and
app deployment, external HTTPS and rollback verification.

Known limitations to resolve before declaring the planned v1 complete:
- Greybox dimensions and route fidelity are estimates awaiting reference review.
- Basic procedural animation/audio need human gameplay review.
- Replay records accepted hit/target pose; server holds players during aftermath.
- No actual GPU performance measurements are implied by headless browser tests.
