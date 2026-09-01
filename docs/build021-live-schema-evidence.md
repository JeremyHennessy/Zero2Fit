# Build 021 live schema evidence

Verified against the connected Supabase project before PR review:

- `workout_sessions`: RLS enabled; authenticated SELECT / INSERT / UPDATE / DELETE grants present.
- `workout_sets`: RLS enabled; authenticated SELECT / INSERT / UPDATE / DELETE grants present.
- Own-row policies exist for SELECT, INSERT, UPDATE and DELETE using the authenticated user ID.
- `workout_sessions` primary key: `(user_id, session_id)`.
- `workout_sets` primary key: `(user_id, set_id)`.
- `workout_sets (user_id, session_id)` references `workout_sessions (user_id, session_id)` with cascade delete.
- Supabase security advisor returned no security lints during this review.

No schema migration was required for Build 021.
