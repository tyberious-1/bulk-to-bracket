# Shared-term spike (reference only, not part of the app or the test suites)

Throwaway scripts from the 2026-10-29 session behind `dev/docs/superpowers/specs/2026-10-29-theme-plan-roles-design.md`.
They are the reference for the measure's definitions until Phase 1 of that plan replaces them with
`dev/tools/jxa-harness/shared_terms.js`. Run from the repo root with node; they read `owned_raw.json` and a
`precon_full.json` that `fetchpre.js` writes (MTGJSON, not committed, regenerate it).

- `qual.js` loads the app's own `js/` files in a node vm and reads cards (`readCard` = connections.js channels).
- `spike.js` the shared-term reading, the 12-pair check set, precon lift. `spike2.js` scores all builds and the precon floor.
- `tribepay.js` counts tribal payoffs the builder's pattern misses. `setup.js` builds decks with the app's code.
- Paths inside point at the session scratchpad layout (`precon_full.json` in the working directory); adjust when promoting.
