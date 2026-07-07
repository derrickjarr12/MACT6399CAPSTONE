# Four-Week Execution Checklist

This checklist is optimized to get your app deployed and validated in four weeks.

## Week 1: Environment and Provider Stabilization

1. Lock provider endpoints and key source in .env.
2. Confirm backend starts cleanly on local machine.
3. Verify MySQL connectivity and table creation.
4. Run provider health checks and record responses.
5. Resolve any 401/404 provider errors.

Exit criteria:
1. GET /api/mysql/health returns connected true.
2. GET /api/provider/health returns checks true for chosen generator.

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

1. Configure host secrets in GitHub:
   - DEPLOY_HOST
   - DEPLOY_USER
   - DEPLOY_SSH_KEY
   - DEPLOY_PORT
   - DEPLOY_PATH
2. Run Deploy Readiness workflow from GitHub.
3. Trigger manual deploy workflow.
4. Validate deployed service endpoints.

Exit criteria:
1. Workflow passes readiness checks.
2. Manual deploy step completes.
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
