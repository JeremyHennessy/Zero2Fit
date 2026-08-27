# Build 008 — Real HealthKit transport + private sync

Baseline: Build 007 merge `f673a7e7f4c77e2b05cebbb41e7c8f8f5fb26c99`.

## Scope

Build 008 makes the previously designed device boundary concrete without weakening RPG integrity or redesigning the approved Build 006 UI.

Implemented:

- live authenticated Supabase project with RLS-protected private tables;
- browser create-account/sign-in/session refresh/private event sync;
- exact HealthKit source observations and explicit source-verification records;
- permanent device-XP trust gate requiring native bridge transport + exact verified source bundle + verification ID;
- native iOS `Zero2FitHealthBridge` source with HealthKit read authorization;
- source-separated daily step totals;
- body mass/body fat/BMI/lean mass, HR, resting HR, HRV, SpO2, active energy, distance, exercise time, VO2 max, sleep and workout capture;
- authenticated native upload with iOS Keychain session storage;
- HealthKit observer/background-delivery registration;
- web Devices controls for private sync and explicit Zepp/RENPHO bundle verification;
- Linux/browser contract tests plus an iOS-simulator compilation workflow.

## Trust change

Prior code could treat an Apple Health XML event as trusted when the imported `sourceName` merely contained strings such as `Zepp`, `Amazfit`, `Apple Watch` or `iPhone`.

Build 008 removes that authorization path. Those strings remain useful for display and source preference only.

Permanent device progression now requires all of:

1. `source_provider == healthkit_bridge`;
2. `bridge_transport_verified == true`;
3. a real HealthKit `source_bundle_id`;
4. explicit source verification loaded from the private account;
5. `source_verification_status == verified`;
6. a concrete `source_verification_id`;
7. existing date/duration/deduplication/per-day XP limits.

## Database status

The connected Supabase project was inspected before use and contained no public application tables. Build 008 applied the Zero2Fit schema rather than overwriting another app.

The live Supabase security advisor reports no security lints. Authenticated table privileges are limited to select/insert/update/delete; anon has no application-table privileges. The progress-photo bucket is private.

At implementation time the project contains no auth users, so the application does not invent an identity. Account creation/sign-in is an explicit user action.

## What is verified by automation

- JavaScript syntax and required-file gates;
- private-sync row conversion and exact-bundle verification matching;
- imported Apple Health source names cannot drive device XP;
- verified native bridge records can pass the trust portion of the XP gate;
- existing workout/device/adventure/photo tests remain intact;
- browser smoke test;
- iOS target generation + iOS simulator compilation.

## What remains physical-device evidence

No repository or cloud test can establish what Zepp or RENPHO Health actually writes on this specific iPhone.

The physical device must still establish:

- exact Zepp `HKSource` name/bundle ID;
- exact RENPHO Health `HKSource` name/bundle ID;
- which requested metric categories each source actually populates;
- representative values against Zepp/RENPHO Health/Apple Health screens;
- physical-device HealthKit background delivery;
- RENPHO underside model label.

Until the actual source bundles are observed and explicitly verified, device data remains usable for trends/reconciliation but cannot create permanent Fitness XP.
