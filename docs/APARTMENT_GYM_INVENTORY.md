# Apartment Gym inventory

Verification date: **2026-08-27**

Evidence basis: **four user-provided photos reviewed visually in ChatGPT**. The photos themselves are intentionally **not** committed to this public repository. This document records only the equipment/functions that can be supported from those images. Model-level identification is separated from function-level identification.

## Confirmed / high-confidence equipment

### HOIST Mi7Smith functional training system

Photo evidence shows both **MiSmith** and **Mi7** branding on the combined HOIST frame. The visible structure matches the HOIST Mi7Smith system.

Confirmed/strongly supported functions:

- dual adjustable cable functional trainer;
- Smith-machine guided bar;
- pull-up station;
- dip station;
- bench positioned for Smith/cable work.

Manufacturer reference:

- https://www.hoistfitness.com/products/mi7smith-functional-training-system

The manufacturer describes the Mi7Smith as the MiSmith Dual Action Smith combined with the Mi7 Functional Trainer, with dual rotating cable columns, pull-up grips and dip grips. This reference is used to confirm functions of the visually identified system, not to infer unrelated accessories elsewhere in the room.

### Selectorized lat pulldown / low-row station

Function confidence: **high**. Exact manufacturer/model: **not verified from the photo**.

Visible evidence:

- wide pulldown bar at the high pulley;
- seated bench and thigh restraint;
- low cable;
- lower row handles/foot-support geometry.

Enabled training intents:

- vertical pull / lats;
- horizontal row / back.

### Life Fitness leg extension / seated leg curl

Brand confidence: **high** (Life Fitness branding visible).

Function confidence: **high** from the dual roller/seat geometry. Exact series/model plate is not legible, so Zero2Fit does not claim a specific Life Fitness series.

Enabled functions:

- leg extension;
- seated leg curl.

Reference for equivalent current Life Fitness dual-function design:

- https://www.lifefitness.com/en-us/catalog/strength-training/selectorized/axiom-series-seated-leg-curl-extension

The reference documents the exercise functions only; it is not evidence that the photographed unit is exactly that current Axiom model.

### Life Fitness shoulder press

Brand confidence: **high**.

Function confidence: **high** from the upright seat/back and overhead press lever geometry. Exact series/model remains unverified.

Enabled function:

- machine shoulder press / vertical push.

Reference for equivalent current Life Fitness function:

- https://www.lifefitness.com/en-us/catalog/strength-training/selectorized/axiom-series-shoulder-press

### Life Fitness pectoral fly / rear deltoid

Brand confidence: **high**.

Function confidence: **high**. The photographed machine visibly carries separate **Pectoral Fly** and **Rear Delt** instruction labels.

Enabled functions:

- pectoral fly;
- rear-deltoid / reverse fly.

Reference for equivalent current Life Fitness dual-function design:

- https://shop.lifefitness.com/products/axiom-series-pectoral-fly-rear-deltoid

## Cardio / conditioning equipment visible

- **Concept2 rowing ergometer** — branding and RowErg form factor visible;
- **at least three treadmills**;
- **at least two elliptical/cross-trainer cardio machines**;
- **three stability balls**.

These cardio items are stored as verified station metadata. The current strength resolver does not treat the presence of a treadmill/rower/elliptical as permission to unlock unrelated strength exercises.

## Equipment deliberately NOT marked available

The photos do not verify the following, so they remain unavailable in the Apartment Gym profile unless later photos establish them:

- free dumbbells;
- free barbell;
- kettlebells;
- resistance bands;
- plyometric box;
- GHD / Roman chair;
- sled.

The Smith machine is **not** treated as a free barbell. Zero2Fit enables Smith-named machine exercises through the verified generic-machine capability filter instead of adding `barbell` to the apartment inventory.

## Generic-machine safety rule

The exercise source uses a broad equipment label, `machine`. Merely marking `machine` available would incorrectly imply that every selectorized machine exists in the apartment gym.

Zero2Fit therefore applies an Apartment Gym machine-name capability filter. Generic `machine` exercises are allowed only when their names correspond to one of the functions seen in the photos:

- Smith;
- leg extension;
- seated leg curl;
- shoulder press;
- pectoral/pec fly or pec deck/butterfly;
- rear delt/rear deltoid/reverse fly;
- lat pulldown;
- low row / seated row.

The adjustable cable trainer is handled separately as `cable_machine`, because its core purpose is to support a broad range of cable movements.

## Future updates

Additional apartment-gym photos can expand this inventory. The rule remains:

**observed equipment/function first → normalized equipment capability → workout selection**.

Do not manually add a machine category simply because a similar exercise would be convenient.
