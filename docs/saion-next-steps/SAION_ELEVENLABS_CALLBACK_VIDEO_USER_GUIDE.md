# SAION User Guide: Song Generation -> ElevenLabs Callback (Video Walkthrough)

This guide is a camera-ready runbook to demonstrate:
1. Generate a song request through SAION.
2. Capture requestId and provider jobId.
3. Send callback payload back into SAION.
4. Verify request state in MySQL-backed request history.

## 1) Prerequisites

Confirm these environment settings in .env:
- ELEVENLABS_API_KEY is set.
- ELEVENLABS_BASE_URL is set.
- ELEVENLABS_GENERATE_PATH is set.
- ELEVENLABS_STATUS_PATH is set.
- NOCODE_CALLBACK_TOKEN is set.
- MySQL settings are valid (already verified in this workspace).

Recommended for provider demo:
- PREFERRED_PROVIDER=elevenlabs

## 2) Start SAION

Run:

```bash
npm run start:prod
```

Health checks:

```bash
curl -s 'http://localhost:3000/api/provider/health?generator=elevenlabs'
curl -s 'http://localhost:3000/api/mysql/health'
```

Expected:
- provider health returns ok: true
- mysql health returns connected: true

## 3) Generate Song Request

Send a generate request to SAION:

```bash
curl -s -X POST 'http://localhost:3000/api/provider/generate' \
  -H 'Content-Type: application/json' \
  -d '{
    "generator": "elevenlabs",
    "prompt": "Create a cinematic 20-second uplifting electronic hook",
    "payload": {
      "voiceId": "TX3LPaxmHKxFdv7VOQHJ"
    }
  }'
```

From the JSON response, capture:
- _pnf.requestId
- _pnf.providerJobId (or jobId from provider body)

Use these in the callback step.

## 4) Callback Path A (Fast Demo Path)

Use this path for a simple recording if you do not need strict signature verification in the demo.

Temporary demo setting in .env:
- ELEVENLABS_REQUIRE_SIGNATURE=false

Restart server after changing env.

Send callback via included adapter script:

```bash
node scripts/elevenlabs-callback-adapter.mjs \
  --callback-url 'http://localhost:3000/api/provider/callback' \
  --request-id '<REQUEST_ID_FROM_GENERATE>' \
  --job-id '<PROVIDER_JOB_ID>' \
  --token '<YOUR_NOCODE_CALLBACK_TOKEN>'
```

This forwards a normalized callback payload into SAION.

## 5) Callback Path B (Production-Accurate Signed Callback)

Use this path when ELEVENLABS_REQUIRE_SIGNATURE=true.

1. Build callback JSON file.

Create callback.json:

```json
{
  "requestId": "<REQUEST_ID_FROM_GENERATE>",
  "generator": "elevenlabs",
  "jobId": "<PROVIDER_JOB_ID>",
  "statusCode": 200,
  "response": {
    "status": "completed",
    "audioUrl": "https://example.com/final-track.mp3"
  }
}
```

2. Generate timestamp and signature.

```bash
export TS=$(date +%s)
export BODY=$(cat callback.json)
export SIG=$(printf '%s' "$TS.$BODY" | openssl dgst -sha256 -hmac "$ELEVENLABS_WEBHOOK_SIGNING_SECRET" | awk '{print $2}')
```

3. Send signed callback.

```bash
curl -s -X POST 'http://localhost:3000/api/provider/callback' \
  -H 'Content-Type: application/json' \
  -H "x-callback-token: $NOCODE_CALLBACK_TOKEN" \
  -H "x-elevenlabs-timestamp: $TS" \
  -H "x-elevenlabs-signature: sha256=$SIG" \
  --data @callback.json
```

Expected response:
- accepted: true
- signature.valid: true

## 6) Verify Callback Result in SAION

Check request record:

```bash
curl -s 'http://localhost:3000/api/provider/requests/<REQUEST_ID_FROM_GENERATE>'
```

What to show on camera:
- normalizedStatus moved to completed
- providerJobId present
- audioUrl present
- record persisted (MySQL mode confirmed by mysql health endpoint)

## 7) Optional: Poll Provider Status Endpoint

If provider returns job processing first, poll status:

```bash
curl -s 'http://localhost:3000/api/provider/status/<PROVIDER_JOB_ID>?generator=elevenlabs&requestId=<REQUEST_ID_FROM_GENERATE>'
```

## 8) Suggested Video Script (Short)

1. Show server startup and both health checks.
2. Send generate request and highlight requestId/jobId.
3. Send callback (fast path or signed path).
4. Query request record and show completed state.
5. End with mysql health showing connected true.

## 9) Troubleshooting

- 401 Unauthorized callback:
  - Check x-callback-token value.
  - If strict mode is true, include valid signature headers.

- 1045 MySQL errors:
  - Confirm saved .env has correct MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE.
  - Restart server after env changes.

- Missing requestId errors:
  - Callback body must include requestId.

## 10) Source References

- API routes and callback validation: src/index.js
- Callback helper script: scripts/elevenlabs-callback-adapter.mjs
- Signed callback test pattern: scripts/test-callback-security.mjs
- Provider proof runner: scripts/proof-provider-run.mjs
