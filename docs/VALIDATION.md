# Validation ledger

This file distinguishes implementation from acceptance evidence.

- Node 24 resource-limited container: TypeScript check and production build pass.
- Initial nine unit/integration tests passed; extended network tests pending.
- npm audit after patched dependencies: zero advisories.
- Initial authenticated client: ~955KB gzip, 2.72MB raw; gate ~3KB raw.
- Gate has no engine/map/WASM/audio imports; server guards every game-prefix request.

Pending: browser results, extended tests, 30-minute 18-client load results,
50–150ms RTT/jitter/loss two-browser gameplay, original Highrise visual/route
comparison, manual traversal and weapon feel review, real integrated-GPU laptop
60FPS/1080p measurement, Firefox/Edge/Safari checks, production secret setup and
app deployment, external HTTPS and rollback verification.

Known limitations to resolve before declaring the planned v1 complete:
- Greybox dimensions and route fidelity are estimates awaiting reference review.
- Initial crouch lowers the eye and movement speed, with standing-size collision.
- Basic procedural animation/audio need human gameplay review.
- Replay records accepted hit/target pose; server holds players during aftermath.
- No actual GPU performance measurements are implied by headless browser tests.
