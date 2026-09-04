# Build 045 — Fuel Friction Detail

Build 045 extends Zero2Fit's existing local-only tuning measurement so Fuel can be improved from real interaction evidence without storing what the user ate.

## User problem

Fuel already supports quick line, manual entry, Repeat Last, saved/recent items, Open Food Facts search and barcode lookup. The remaining product question is not whether these features exist; it is which parts create repeated friction in actual use.

Build 045 measures only the categorical outcomes needed to answer that question.

## New measured outcomes

### Add Food completion

When the Add Food panel opens, Zero2Fit remembers only the local entry count for that ephemeral panel session. When the panel closes, the tuning store receives one categorical outcome:

- `logged`
- `abandoned`

The close path is also categorical (`close_button`, `backdrop`, or `escape`). The underlying food rows and nutrition values are never copied into the tuning store.

### Food lookup outcomes

Search, barcode and supported camera-scan attempts can resolve to:

- `success`
- `empty`
- `error`

The tuning event stores only the lookup method and outcome. It does not store query text, barcode values, product names, serving text, calories or macros.

### Manual-entry dependence

Build 045 reuses the existing Build 043 `fuel_entry_logged` method categories to determine whether the full manual form remains the dominant path compared with shortcuts such as Repeat Last, saved/recent items and food database results.

## Derived signals

Conservative 14-day signals now include:

- **Add Food sessions are often abandoned** — at least four closed sessions and at least half end without a new entry.
- **Food lookup often misses a usable result** — at least four resolved lookups and fewer than half succeed.
- **Fuel logging still leans on manual entry** — at least six measured entries, at least 60% manual, and no more than two shortcut entries.

These are evidence labels only. Build 045 does not automatically change Fuel defaults or recommendations.

## Explicit local control

The Progress tuning card now exposes:

- **Pause measurement**
- **Resume measurement**
- the existing **Clear tuning history** action

Pausing stops Builds 043, 044 and 045 from recording new tuning events. Existing local tuning history remains until explicitly cleared. Fitness, Fuel, Adventure, progress-photo, device and sync data are not affected.

## Privacy contract

The local tuning store remains `zero2fit-usage-v1` with the existing 90-day / 1,600-event cap.

Build 045 does not persist in tuning history:

- food names
- search queries
- barcode values
- serving text
- calories
- protein, carbohydrate or fat values
- body measurements or step counts
- HealthKit source/bundle identifiers
- account identity or credentials
- progress photos

Build 045 makes no analytics/network/Supabase write.

## Authority boundaries

Unchanged:

- Fuel nutrition history remains authoritative in the existing Fuel storage/sync model.
- Explicit nutrition targets remain user-entered; Zero2Fit does not infer calorie targets or weight-loss direction.
- Open Food Facts remains provider/reference data rather than a tuning authority.
- Device trust and permanent Fitness XP rules are untouched.
- Build 045 does not automatically tune Fuel from synthetic QA or insufficient real history.

## Verification

Build 045 adds:

- usage-core tests for panel abandonment, lookup outcomes and manual-entry dependence;
- static privacy/wiring checks that reject raw food/query/barcode/nutrition fields and network analytics;
- a deterministic populated Fuel-friction browser fixture;
- whole-app readiness sentinel `data-zero2fit-fuel-friction="ready"`;
- versioned offline shell `zero2fit-shell-v45-fuel-friction`.
