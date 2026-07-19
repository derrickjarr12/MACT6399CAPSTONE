# 05. Testing and QA

## Current QA Strategy

Project phase is reliability-first test execution, aligned to a four-week freeze discipline.

Primary planning docs:

- ../../../README.md
- ../../saion-next-steps/NEXT_STEPS_README.md
- ../../saion-next-steps/FOUR_WEEK_EXECUTION_CHECKLIST.md

## Baseline Compatibility Test

Test file:

- ../../../ARLNS/compat_baseline_v1.test.js

Purpose:

1. Lock tokenizer token sequence behavior
2. Lock parser section and dynamic mapping behavior
3. Lock validator baseline (errors/warnings)
4. Lock pipeline end-to-end validation baseline

Run:

- npm run test:compat

## Preflight Quality Gate

Command:

- npm run preflight

Sequence:

1. compatibility test
2. GUI production build
3. startup env validation

This is the fastest confidence check before merge/deploy/demo rehearsal.

## Provider Proof Runs

Commands:

1. npm run proof:mureka
2. npm run proof:elevenlabs
3. npm run proof:stack

Purpose:

- Validate provider execution and status lifecycle under current env setup

## Manual Functional QA Focus

Critical manual flows:

1. Prompt + dial update and generated prompt integrity
2. Generate submission and status polling
3. Audio URL artifact loading and playback
4. A/B save and switch behavior
5. Session save/load/export path
6. GUI responsiveness across desktop, tablet, and mobile classes

## Failure-Mode QA

Required scenario classes:

1. Missing/invalid provider key
2. Provider timeout
3. Provider 404/5xx path fallback
4. MySQL unavailable mode
5. Dry-run mode behavior

Expected outcome:

- No hard crash
- Clear user/system status messaging
- Recoverable next action

## Evidence and Traceability

Issue evidence template (recommended):

1. issue ID
2. severity
3. reproduction steps
4. expected result
5. actual result
6. fix applied
7. verification result
8. timestamp and tester

## Demo-Hardening QA Cadence

Daily lightweight routine:

1. provider health check
2. mysql health check
3. one generate request
4. one status polling completion
5. log failures with requestId and timestamp

This keeps run reliability visible and reduces surprise failures near presentation time.
