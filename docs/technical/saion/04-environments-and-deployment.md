# 04. Environments and Deployment

## Local Development

Root commands (from ../../../package.json):

1. npm start
   - Starts Node backend via src/index.js
2. npm run dev
   - Starts backend with nodemon
3. npm run dev:gui
   - Starts GUI dev server in gui/
4. npm run build:gui
   - Builds GUI production assets

## Environment Configuration

Primary setup guide:

- ../../../SETUP_ENV_KEYS.md

Configuration spans:

1. Provider credentials and base URLs
2. Provider generate/status path templates
3. Backup path candidates for endpoint fallback
4. Preferred provider and fallback ordering
5. Optional dry-run mode
6. Optional MySQL persistence variables

## MySQL Integration

Runtime supports optional DB persistence with variables for:

1. host, port, user, password, database
2. table name
3. pool connection limit
4. optional SSL config controls

Health check endpoint:

- /api/mysql/health

## Deployment Model

Current docs recommend GitHub-sourced deployment to Node-compatible platforms with externalized env vars.

Primary deployment instructions:

- ../../saion-next-steps/GITHUB_DEPLOYMENT_INSTRUCTIONS.md

Typical runtime shape:

1. Build/install dependencies
2. Start via npm start
3. Validate /api/provider/health and /api/mysql/health
4. Run smoke generate + status flow

## Production Serving

Backend includes a catch-all non-API route that serves GUI application files for SPA navigation behavior.

This allows a single process to host:

1. API endpoints
2. GUI production build

## Packaging and Release Artifacts

Script:

- ../../../scripts/package-guis.mjs

Supports packaging targets:

1. v1 from legacy path
2. v1.2 from current gui path

Process:

1. Run GUI build
2. Copy dist output into releases/<label>/dist
3. Write release manifest
4. Append release-history.jsonl

## Operational Readiness Checklist

Before deployment:

1. Validate startup/env checks
2. Validate provider health endpoint
3. Validate mysql health endpoint (if DB enabled)
4. Build GUI and confirm static assets
5. Execute at least one end-to-end generation and status poll

After deployment:

1. Repeat health checks against deployed URL
2. Run smoke generate/status test
3. Validate request lookup by requestId
4. Confirm fallback provider behavior is deterministic
