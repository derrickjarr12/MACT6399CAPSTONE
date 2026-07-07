# MACT6399 Capstone: Test-Only Execution Plan (4 Weeks)

## Purpose
This document defines a strict test-only plan for the next four weeks.

Project policy from this point forward:
1. No new features.
2. Only testing, verification, and defect fixes for required flows.
3. Every fix must be tied to a reproducible failure.

## Scope Freeze Rules
1. No new code paths.
2. No refactors unless required to fix a failing test.
3. Every bug fix must include:
   - Reproduction steps
   - Expected vs actual behavior
   - Verification evidence after fix

## Week 1: Baseline and Stability
1. Run startup validation and confirm environment checks pass.
2. Run compatibility test and GUI build.
3. Capture baseline evidence:
   - Startup output
   - Provider health responses
   - Build output
4. Create a bug list by severity:
   - Critical (blocks demo)
   - Major (degrades demo)
   - Minor (non-blocking)
5. Fix only Critical issues.
6. Re-run baseline checks after each fix.

Definition of done (Week 1):
1. Startup is clean.
2. Build is clean.
3. Core app loads.
4. No Critical issue remains in baseline path.

## Week 2: Core Flow Reliability
1. Test end-to-end generation flow with a fixed prompt set.
2. Test status polling and request lookup paths.
3. Run at least 10 repeated core-flow runs.
4. Record pass/fail and failure reason for each run.
5. Fix only reproducible core-flow failures.

Definition of done (Week 2):
1. At least 8 out of 10 runs pass.
2. No untriaged failure remains.
3. Remaining failures have clear workaround notes.

## Week 3: Failure and Fallback Behavior
1. Simulate failure scenarios:
   - Missing key
   - Invalid key
   - Timeout
   - Bad payload
2. Verify error handling and recovery behavior.
3. Verify fallback behavior for the chosen provider order.
4. Re-test successful path after failure tests.

Definition of done (Week 3):
1. All failure scenarios are handled without crashes.
2. User-facing errors are clear.
3. Recovery path is documented.

## Week 4: Final Verification and Demo Hardening
1. Run full regression pass:
   - Startup
   - Build
   - Health checks
   - Generate flow
   - Status polling
   - GUI demo path
2. Run 3 final demo rehearsals on different days.
3. Freeze code changes 3 to 4 days before presentation.
4. Use known-good prompts/settings for final demo.
5. Prepare one backup runbook for provider outage.

Definition of done (Week 4):
1. Demo flow passes 3 consecutive rehearsals.
2. No Critical or Major open issues.
3. Backup procedure is ready.

## Daily 30-Minute Test Cadence
1. 10 minutes: run fixed smoke test set.
2. 10 minutes: triage and prioritize failures.
3. 10 minutes: verify fixes and log evidence.

## Required Evidence Template (per issue)
1. ID
2. Severity
3. Reproduction steps
4. Expected result
5. Actual result
6. Fix applied
7. Verification result
8. Date and tester

## Submission Summary
This plan enforces feature freeze discipline and focuses on reliability, regression safety, and demo readiness through structured testing over four weeks.
