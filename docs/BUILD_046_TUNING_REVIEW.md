# Build 046 — Tuning Review

Build 046 fixes a discoverability problem created as Zero2Fit's local measurement layer became richer: the Progress tuning card intentionally rendered only the first three signals, so valid lower-priority Training/Fuel patterns could exist without any indication that they were hidden.

## Behavior

The tuning card remains compact by default.

When the current 14-day summary contains more than three derived signals it now shows:

- `Showing 3 of N signals`
- **Show all N**

Expanding the review shows every currently derived signal in the same order returned by `usage-core.mjs` and changes the control to:

- `Showing all N signals`
- **Show top 3**

When three or fewer signals exist, no review toggle is shown.

## What does not change

Build 046 changes presentation/discoverability only.

It does **not**:

- add or remove friction-signal thresholds;
- reorder or reprioritize signals;
- change the 14-day measurement window;
- change the 90-day / 1,600-event local retention boundary;
- make a network/Supabase analytics write;
- enable automatic tuning;
- change training prescriptions, Fuel targets, Adventure pacing, device trust, private sync or permanent Fitness XP.

The top-three default remains useful because fitness evidence should stay visually primary on Progress. Expansion is an explicit review action rather than a permanently larger dashboard.

## Accessibility / mobile

The review control uses `aria-expanded` and a minimum 40px mobile hit area. The expanded state is covered by a full-height iPhone screenshot so additional signals cannot silently reintroduce horizontal overflow or compressed-column layout.

## QA

Build 046 adds a deterministic fixture with eleven independently derived signals.

The browser contract verifies:

- collapsed state renders exactly the first three signals;
- the fourth signal is absent from collapsed DOM;
- the control reports `3 of 11` and `Show all 11`;
- expanded state reports `all 11` and `Show top 3`;
- all eleven signals become discoverable;
- signal ordering is not modified in the review layer.

The active PWA cache lineage becomes `zero2fit-shell-v46-tuning-review`.
