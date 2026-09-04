# Build 047 — Adventure Friction Detail

Build 047 extends the existing local-only tuning model with two explainable Adventure signals. It uses categorical `adventure_run` outcomes Zero2Fit already records; it does not add another Adventure event stream or change the RPG engine.

## Why

Adventure can intentionally stop for different reasons. A single wall is normal game behavior. Repeated walls across real use are useful product evidence because they can later tell us whether pacing/gear presentation should be tuned.

The measurement layer must not turn a game wall into pressure to exercise more.

## Signals

### Repeated combat walls

Derived only when:

- at least 4 active progression runs exist;
- at least 3 ended at `combat_wall`;
- at least 50% of active progression runs ended at `combat_wall`.

The signal explicitly says this is pacing evidence and **not a prompt to train extra**.

### Repeated real-capability gates

Derived when at least 3 runs end at `capability_gate`.

This is deliberately low severity because capability gating is part of Zero2Fit's integrity model. The signal explicitly says it is expected fitness-ceiling evidence and **not a prompt to overtrain**.

## Denominator

Active progression runs include only:

- `advancing`
- `combat_wall`
- `capability_gate`

`paused` and `content_complete` outcomes are excluded. They are not progression failures and must not inflate a friction rate.

## Authority boundary

Build 047 does not modify:

- enemies, bosses, damage or HP;
- stage progression;
- loot, materials, equipment or auto-equip;
- raw/effective gear power;
- real-fitness capability ceilings;
- Fitness XP or permanent XP authority;
- workout prescriptions or Daily Guidance;
- device trust or private sync.

No automatic Adventure tuning is enabled. Synthetic QA only proves derivation and presentation; real representative history is still required before game pacing changes are justified.

## QA

Build 047 adds:

- pure model tests for combat-wall and capability-gate thresholds;
- tests proving a single wall is insufficient;
- tests proving paused/content-complete outcomes are excluded;
- anti-overtraining wording assertions;
- a deterministic browser fixture that renders both signals in Progress;
- a focused authority-boundary workflow;
- PWA cache lineage `zero2fit-shell-v47-adventure-friction`.
