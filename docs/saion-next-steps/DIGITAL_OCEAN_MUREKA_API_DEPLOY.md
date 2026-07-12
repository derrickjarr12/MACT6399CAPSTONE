# DigitalOcean Mureka API Deployment

This runbook deploys the MACT6399CAPSTONE backend API to a DigitalOcean Droplet with Mureka as the primary provider.

## Target Architecture

1. Node/Express API runs on `127.0.0.1:3000` under PM2.
2. Nginx reverse-proxies public traffic on port `80` to Node.
3. Mureka is primary provider (`PREFERRED_PROVIDER=mureka`).
4. ElevenLabs can remain configured as fallback.

## Prerequisites

1. Ubuntu 22.04 or 24.04 Droplet.
2. Repo cloned on the Droplet.
3. `.env` configured with valid Mureka values.
4. Firewall allows 22, 80, 443.

## Required `.env` Variables

```env
PREFERRED_PROVIDER=mureka
FALLBACK_PROVIDERS=elevenlabs

MUREKA_API_KEY=your_real_mureka_key
MUREKA_BASE_URL=https://api.mureka.ai
MUREKA_GENERATE_PATH=your_mureka_generate_path
MUREKA_STATUS_PATH=your_mureka_status_path_with_jobId

ELEVENLABS_API_KEY=your_real_elevenlabs_key
ELEVENLABS_BASE_URL=https://api.elevenlabs.io
ELEVENLABS_GENERATE_PATH=your_elevenlabs_generate_path
ELEVENLABS_STATUS_PATH=your_elevenlabs_status_path
ELEVENLABS_VOICE_ID=your_voice_id
```

## One-Time Droplet Setup

From the project root on the Droplet:

```bash
chmod +x deploy/digitalocean/bootstrap-droplet.sh
./deploy/digitalocean/bootstrap-droplet.sh /opt/mact6399capstone "$USER"
```

If PM2 startup prints a command containing `sudo env PATH=... pm2 startup ...`, run that command once.

## Start and Verify

```bash
npm run pm2:restart
curl "http://127.0.0.1:3000/api/provider/health?generator=mureka"
curl "http://<droplet-ip>/api/provider/health?generator=mureka"
```

Expected health response includes:

1. `ok: true`
2. `checks.apiKey: true`
3. `checks.baseUrl: true`
4. `checks.generatePath: true`
5. `checks.statusPath: true`

## Proof Run (Mureka)

```bash
node scripts/proof-provider-run.mjs --generator mureka --base http://127.0.0.1:3000 --no-poll
```

If this returns `404`, your Mureka endpoint path is wrong; update `MUREKA_GENERATE_PATH` and retry.
If this returns `401`, your key is invalid/expired.

## GitHub Manual Deploy Secrets

Configure these repository secrets:

1. `DEPLOY_HOST`
2. `DEPLOY_USER`
3. `DEPLOY_SSH_KEY`
4. `DEPLOY_PORT`
5. `DEPLOY_PATH`

Then run workflow `Deploy Readiness and Manual Deploy` with `run_deploy=true`.

## Operational Commands

```bash
pm2 status
pm2 logs mact6399capstone
pm2 restart ecosystem.config.cjs --env production
sudo systemctl status nginx
```

## Notes

1. MySQL errors do not block API startup; service falls back to in-memory mode.
2. For production stability, configure a real MySQL password and reachable DB.
3. Rotate provider keys if they were ever shared in plaintext.
