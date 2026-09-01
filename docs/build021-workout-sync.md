# Build 021 — Workout private continuity

Build 021 makes completed workout sessions and set/load history part of the existing authenticated private-sync flow.

## Contract

- Existing `workout_sessions` and `workout_sets` tables are reused; no schema change is required.
- Session and set IDs are deterministic so the same local workout maps to the same remote records on different browsers.
- Set edits carry a local edit timestamp and reconcile last-write-wins against remote `metadata.updated_at`.
- Sessions are upserted before sets so the existing `(user_id, session_id)` foreign key remains satisfied.
- Pulled rows hydrate the existing `workoutSets` / `workoutHistory` structures consumed by the adaptive engine.
- Workout continuity never creates, imports, or overwrites permanent Fitness XP or character attributes.
- Existing `Sync now` remains the only private-sync action; Build 021 extends it rather than introducing a second sync system.

## Acceptance evidence

Deterministic tests cover local→remote mapping, local-vs-remote edit conflicts, hydration without XP changes, and adaptive progression after a cross-browser round trip. The progression test verifies that two restored 35 lb × 12 top-range exposures still recommend 40 lb next.

A true authenticated browser-to-browser acceptance remains part of Build 020 and requires the real user account/session rather than invented credentials.
