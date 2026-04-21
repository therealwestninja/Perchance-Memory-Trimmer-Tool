Extended test suite additions for the current Perchance Memory Trimmer project.

Added coverage:
- protection store and stable entry IDs
- pins, snapshots, storage wrapper, schema/backfill, storage health
- continuity, conflicts, topics, timeline beats, lore helpers, workspace guardrails
- health scoring, budget pressure, repetition hotspots, relevance scoring, token source selection
- UI static contracts for panel accessibility wiring, QA fetch handling, bubble-map semantics, and theme template integrity

Scripts added:
- npm run test:legacy
- npm run test:extended
- npm test  (now runs the extended suite)

Current expected status on this upload:
- most new tests pass
- ui_static_contracts.test.js currently fails on the light-theme template integrity check in src/ui/theme.js
  because LIGHT_CSS is not properly terminated before JS resumes.
