# 06. Release and Roadmap

## Release History (Current Known)

Source:

- ../../../releases/release-history.jsonl

Observed entries include:

1. gui-v1 package lineage
2. gui-v1.2 package lineage
3. repeated v1.2 packaging timestamps

Each release entry captures:

- version tag
- package name
- source path
- source package version
- git commit
- build timestamp
- output path

## Release Packaging Workflow

Script:

- ../../../scripts/package-guis.mjs

Workflow behavior:

1. choose target (v1, v1.2, or both)
2. run npm build in target GUI folder
3. copy dist output to releases/<target>/dist
4. write release-manifest.json in target folder
5. append JSON line to release-history.jsonl

## Operational Release Criteria

Minimum release readiness for current project phase:

1. preflight passes
2. provider and mysql health checks are green
3. one full generate-to-completion cycle is verified
4. no unresolved critical issue in baseline flow

## Current Stabilization Plan

Test-only, no-feature-expansion policy is documented in:

- ../../../README.md
- ../../saion-next-steps/NEXT_STEPS_README.md
- ../../saion-next-steps/FOUR_WEEK_EXECUTION_CHECKLIST.md

Focus:

1. reproducibility
2. recovery behavior
3. demo resilience

## V2 Option Set (Deferred)

Planning files:

- ../../saion-next-steps/V2_OPTIONS_NOTES.md
- ../../saion-next-steps/V2_PRIORITIZATION_MATRIX.md

Candidate directions:

1. SAI guidance assistant concept
2. mood-driven personalization
3. orb internal video texture layer
4. live vocal FX preview module

## Recommended Documentation Governance

To keep this technical folder complete from start to finish over time:

1. On each release, update release notes section in this file and refresh source links if paths change.
2. On each architectural/API change, update chapters 02 and 03 before merge.
3. On each deployment policy change, update chapter 04.
4. On each QA process change, update chapter 05.
5. Keep V2 intent and scope boundaries synchronized with saion-next-steps docs.

## Suggested Next Milestones

1. Add explicit CHANGELOG.md in docs/technical/saion with date-stamped technical deltas.
2. Add architecture diagram snapshots for backend route flow and GUI state flow.
3. Add a runbook appendix for emergency provider failover during demos.
