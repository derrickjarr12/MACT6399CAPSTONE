# Four-Week Execution Checklist

This checklist is optimized to get your app deployed and validated in four weeks.

## Week 1: Environment and Provider Stabilization

1. Lock provider endpoints and key source in .env.
2. Choose provider transport mode:
   - Direct HTTP provider paths
   - Official Mureka MCP server (lyrics/song/bgm APIs)
3. If MCP mode is selected, run MCP server locally and confirm client connectivity.
4. Confirm backend starts cleanly on local machine.
5. Verify MySQL connectivity and table creation.
6. Run provider health checks and record responses.
7. Resolve any 401/404 provider errors.

Exit criteria:

1. GET /api/mysql/health returns connected true.
2. GET /api/provider/health returns checks true for chosen generator.
3. If MCP mode is enabled, at least one successful MCP request is logged with requestId and provider jobId.

MCP readiness checklist:

1. MCP server process is reachable from selected client runtime.
2. Lyrics generation call succeeds.
3. Song generation call succeeds.
4. BGM generation call succeeds.
5. Job status polling returns terminal state for at least one sample run.

Proof-first path (recommended for this project right now):

1. Set `PREFERRED_PROVIDER=mureka` and `FALLBACK_PROVIDERS=elevenlabs`.
2. Ignore SUNO/UDIO for demo validation.
3. Run `npm run proof:mureka`.
4. Run `npm run proof:elevenlabs`.
5. Archive requestId/providerJobId output for demo evidence.

## Week 2: End-to-End Job Flow

1. Submit generation requests from UI and cURL.
2. Capture requestId and provider jobId for each run.
3. Poll status endpoint until completion/failure.
4. Confirm job records persist in MySQL.
5. Fix all reproducible flow breaks.

Exit criteria:

1. At least 5 successful full runs.
2. No blocker in submit -> status -> result pipeline.

## Week 3: GitHub Deployment Pipeline

1. Run Deploy Readiness workflow from GitHub.
2. Choose a host and configure its runtime environment variables outside the repo.
3. Deploy the current `main` branch using the host's normal release flow.
4. Validate deployed service endpoints.

Exit criteria:

1. Workflow passes readiness checks.
2. Deployment completes on the selected host.
3. Deployed environment reports healthy provider and DB checks.

## Week 4: Demo Hardening and Freeze

1. Run three full rehearsals on different days.
2. Capture expected/actual output for each rehearsal.
3. Keep a fallback provider plan ready.
4. Freeze code changes except critical fixes.

Exit criteria:

1. Three consecutive successful demo rehearsals.
2. No critical open issues.

## Daily 20-Minute Routine

1. Hit provider health endpoint.
2. Hit mysql health endpoint.
3. Run one generate request and one status poll.
4. Log failures with requestId and timestamp.
