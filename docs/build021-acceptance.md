# Build 021 acceptance checklist

Software acceptance for workout private continuity:

- deterministic session/set identities
- local/remote last-write-wins set conflict handling
- authenticated Data API uses only the public client key plus user JWT
- existing per-user RLS remains enabled on `workout_sessions` and `workout_sets`
- sessions upsert before sets
- remote rows hydrate `workoutSets` and completed `workoutHistory`
- adaptive next-load logic consumes restored history
- no permanent Fitness XP or attribute mutation from hydration
- browser renders the workout-continuity status strip
- clean-theme iPhone and desktop Train screenshots pass
- Pages / reference sync pass after merge

Human UAT is intentionally separate: the real private account and second-browser round trip belong to Build 020 and are not simulated with invented credentials.
