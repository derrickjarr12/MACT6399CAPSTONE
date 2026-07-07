# GitHub Deployment Instructions (Node + MySQL)

This guide gives you a clean deployment path from GitHub for this project.

## 1. Pre-Deployment Checklist

1. Confirm local app health:
	- Provider health endpoint responds.
	- MySQL health endpoint responds with connected true.
2. Confirm branch is up to date and pushed to GitHub.
3. Confirm .env is not committed.
4. Confirm all production values are available (DB, provider key, optional ElevenLabs values).

## 2. Required Environment Variables

Set these on your hosting platform (not in GitHub repo files):

Core runtime:
1. NODE_ENV=production
2. PORT=3000 (or platform-provided PORT)

MySQL:
1. MYSQL_HOST
2. MYSQL_PORT
3. MYSQL_USER
4. MYSQL_PASSWORD
5. MYSQL_DATABASE
6. MYSQL_TABLE=pnf_request_jobs
7. MYSQL_CONNECTION_LIMIT=10
8. MYSQL_SSL=true (recommended for managed DB)
9. MYSQL_SSL_REJECT_UNAUTHORIZED=true
10. MYSQL_SSL_CA_BASE64 (optional, if provider requires custom CA)

Provider (Udio/UdioProAPI path currently used by project):
1. UDIOPROAPI_API_KEY
2. UDIOPROAPI_BASE_URL=https://udioapi.pro/api
3. UDIOPROAPI_UDIO_GENERATE_PATH=/v2/generate
4. UDIOPROAPI_SUNO_GENERATE_PATH=/v2/generate
5. UDIOPROAPI_STATUS_PATH=/v2/jobs/{jobId}

Optional ElevenLabs:
1. ELEVENLABS_API_KEY
2. ELEVENLABS_VOICE_ID
3. ELEVENLABS_BASE_URL (if using backend provider route)
4. ELEVENLABS_GENERATE_PATH (if using backend provider route)
5. ELEVENLABS_STATUS_PATH (if using backend provider route)

## 3. GitHub Repository Setup

1. Push your latest branch to GitHub.
2. Confirm branch protection rules if needed (optional).
3. Add GitHub Actions secrets only if you use CI/CD workflows that need them.

Recommended GitHub secrets for deployment workflows:
1. DEPLOY_HOST
2. DEPLOY_USER
3. DEPLOY_SSH_KEY
4. DEPLOY_PORT
5. Optional: provider and DB secrets if your workflow injects env at deploy time.

## 4. Recommended Deployment Model

Use GitHub as source, and deploy to a host that supports Node services.

Good choices:
1. Render
2. Railway
3. Fly.io
4. DigitalOcean App Platform or Droplet

For each host:
1. Connect GitHub repo.
2. Select branch (main or your chosen deployment branch).
3. Build command: npm install
4. Start command: npm start
5. Add all environment variables listed above.

## 5. DigitalOcean Database Notes

If using DigitalOcean managed MySQL:
1. Create database pnf_aims.
2. Add app host IP to Trusted Sources.
3. Use SSL settings from your DB connection info.

The backend auto-creates table pnf_request_jobs on startup when DB credentials are valid.

## 6. Post-Deploy Verification

After deploy, run these checks against your deployed URL:

1. Health endpoint:
	- GET /api/provider/health?generator=udio
2. MySQL endpoint:
	- GET /api/mysql/health
3. Generate smoke test:
	- POST /api/provider/generate with generator udio and a test prompt

Expected:
1. Provider health returns ok true.
2. MySQL health returns connected true.
3. Generate request returns either a provider job id or a clear auth/message error.

## 7. Common Failures and Fixes

1. Invalid API key:
	- Rotate key and update environment variable on host.
2. MySQL not configured:
	- Check MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE.
3. MySQL SSL errors:
	- Enable MYSQL_SSL and provide CA when required.
4. Route not found from provider:
	- Re-check BASE_URL and path values.

## 8. Safe Operations

1. Never commit .env.
2. Keep .env.example as template with placeholders only.
3. Rotate compromised keys immediately.
4. Use least-privilege DB users in production.

