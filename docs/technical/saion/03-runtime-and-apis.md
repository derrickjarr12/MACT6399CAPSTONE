# 03. Runtime and APIs

## Service Runtime

Entry point: ../../../src/index.js

Key runtime behavior:

1. Loads env config and startup validation modules.
2. Configures Express JSON body parsing (25mb limit).
3. Enables CORS for GET/POST/OPTIONS.
4. Initializes in-memory request store and optional MySQL pool.
5. Exposes provider, request, health, and assets endpoints.

## Provider Resolution

Generator routing supports at least:

1. mureka
2. udio (including UdioProAPI-compatible env values)
3. elevenlabs
4. default fallback route via suno/udio-style env configuration

Runtime helpers implement:

- candidate path generation from primary + backup paths
- path token replacement for {jobId} and :jobId
- status-path query fallback when token is absent
- provider-specific header shaping (including xi-api-key for ElevenLabs)

## API Endpoints

### Generation

- POST /api/provider/generate
- POST /api/apiframe/generate

Purpose:

- Submit generation request payload
- Route to selected provider
- Persist request state
- Return request identity and provider/job status details

### Status Polling

- GET /api/provider/status/:jobId
- GET /api/apiframe/status/:jobId

Purpose:

- Poll provider job state
- Return normalized status
- Surface artifacts when available

### Request Lookup

- GET /api/provider/requests/:requestId
- GET /api/apiframe/requests/:requestId

Purpose:

- Retrieve request record by internal requestId
- Support session continuity and lookup independent of provider job ID

### Live Request Stream (SSE)

- GET /api/provider/stream/:requestId
- GET /api/apiframe/stream/:requestId

Purpose:

- Open a live Server-Sent Events stream for one requestId
- Receive immediate updates when callback or polling writes new state
- Emit request snapshot on connect and incremental updates afterward

SSE event names:

- stream-open
- request-snapshot
- request-updated
- heartbeat

### Provider Callback Ingest

- POST /api/provider/callback
- POST /api/no-code/callback
- POST /api/apiframe/callback

Purpose:

- Accept async completion/progress callbacks from providers or no-code orchestrators
- Upsert request state by internal requestId
- Trigger live stream updates for connected clients

Callback auth:

- If NOCODE_CALLBACK_TOKEN or PROVIDER_CALLBACK_TOKEN is configured, callback must include token in one of:
  - x-callback-token header
  - Authorization: Bearer TOKEN_VALUE
  - callbackToken in query/body

Callback signature verification (ElevenLabs):

- SAION records callback audit logs with signature metadata (`[callback-audit] ...`).
- If `ELEVENLABS_REQUIRE_SIGNATURE=true`, ElevenLabs callbacks are rejected unless signature validation succeeds.
- Signature validation uses `ELEVENLABS_WEBHOOK_SIGNING_SECRET` and callback raw body.
- Supported signature header aliases include `x-elevenlabs-signature` and `elevenlabs-signature`.

Minimal callback payload:

```json
{
  "requestId": "req_123",
  "generator": "elevenlabs",
  "jobId": "job_456",
  "statusCode": 200,
  "response": {
    "status": "completed",
    "audioUrl": "https://..."
  }
}
```

### Health

- GET /api/provider/health
- GET /api/apiframe/health
- GET /api/mysql/health

Purpose:

- Verify provider config readiness
- Verify DB connection health where enabled

### Texture Preset Data

- GET /api/assets/texture-presets

Purpose:

- Provide texture preset metadata for GUI visualization assets

### FFmpeg Media Endpoints

Current media-processing endpoints include FFmpeg health, artifact retrieval, and visualization.

See full details in:

- [07-ffmpeg-integration.md](./07-ffmpeg-integration.md)

## Canonical Request/Response Contract

Contract implementation: ../../../src/provider_contract_v1.js
Contract spec: ../../../ARLNS/spec/provider-contract-v1.md

Core ideas:

1. Canonical operations and required input rules
2. Structured request envelope with input, audio, voice, melody, arlns, options
3. Normalized result envelope with status/job/artifacts/usage/error fields

## Persistence Semantics

Two persistence tracks are supported:

1. In-memory requestStore (always available)
2. MySQL table (preferred when configured)

Expected stored fields include request identity, provider job identity, status, and output references for recovery after restart.

## Dry-Run and Operational Modes

Runtime behavior includes support for dry-run execution via environment toggle and configurable provider preference/fallback ordering for reliability testing and demo hardening.

## GUI-to-API Flow (Current)

In App-new.jsx, generate flow follows:

1. Build prompt and notation payload from current dial state.
2. Submit to generate endpoint with selected generator.
3. If direct URL returns immediately, use it.
4. Otherwise poll status endpoint with returned job ID.
5. On completion, update generated audio URL and playback state.
