# Preflight Test Guide

This guide documents all preflight test commands and when to use each one.

## Command Matrix

1. `npm run preflight`
- Scope: local quality gate
- Runs:
  1. compatibility baseline test
  2. GUI production build
  3. startup environment validation
- Use when: before merge, before demo rehearsal, before packaging

2. `npm run preflight:startup`
- Script: `scripts/preflight-startup.sh`
- Scope: full local startup verification
- Runs:
  1. GUI build
  2. startup env validation
  3. temporary production API boot on port 3100
  4. health endpoint readiness check (`/health`)
- Use when: validating boot reliability and health readiness

3. `npm run preflight:live -- https://your-app.example.com`
- Script: `scripts/preflight-live.sh`
- Scope: deployed instance smoke check
- Checks:
  1. `/health` returns HTTP 200
  2. `/health` body includes `ok:true`
  3. app root (`/`) returns HTTP 200
- Use when: post-deployment verification and release smoke testing

## Recommended Usage Order

1. `npm run preflight`
2. `npm run preflight:startup`
3. `npm run preflight:live -- <deployment-url>`

## CI/CD Notes

- `preflight` is the default fast gate for local and CI checks.
- `preflight:startup` is useful in release branches before cut/tag.
- `preflight:live` should run against staging and production URLs after deploy.

## Failure Triage

- If `preflight` fails on build: inspect GUI build output first.
- If `preflight:startup` fails health readiness: inspect `/tmp/pnf-preflight-startup.log`.
- If `preflight:live` fails: confirm deployment URL, network access, and service health.
