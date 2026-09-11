# Validation ledger

This file distinguishes implementation from acceptance evidence.

- Node 24 resource-limited container: TypeScript check and production build pass.
- 26 unit/integration and route tests passed, including sockets, capacity races,
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

Pending: original Highrise visual comparison, manual traversal and weapon feel
review, real integrated-GPU laptop 60FPS/1080p measurement, Firefox/Edge/Safari
checks, production app deployment, external HTTPS and rollback verification.

Known limitations to resolve before declaring the planned v1 complete:
- Greybox dimensions and route fidelity are estimates awaiting reference review.
- Basic procedural animation/audio need human gameplay review.
- Replay records accepted hit/target pose; server holds players during aftermath.
- No actual GPU performance measurements are implied by headless browser tests.
