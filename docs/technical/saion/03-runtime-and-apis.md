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

## Generated Audio Lifecycle

**CRITICAL: Complete journey of audio from generation through storage, retrieval, and export.**

### Phase 1: Generation & Backend Storage

1. **Frontend Submission**: React GUI calls `handleGenerateAudio()` which POSTs prompt + settings to `/api/apiframe/generate`

2. **Backend Reception**: Express endpoint `POST /api/provider/generate` receives request:
   - Extracts prompt, generator, payload, requestId
   - Resolves provider config (currently ElevenLabs only)
   - Sends to ElevenLabs API with source audio (if uploaded)

3. **ElevenLabs Response**: Provider returns binary audio stream (MP3/WAV/M4A)

4. **Temporary Storage**: Backend writes audio bytes to OS temp directory:
   ```
   File Path: /tmp/saion-elevenlabs-music-{timestamp}-{hex}.mp3
   Purpose: Temporary buffer for serving to frontend
   ```

5. **Artifact Registration**: Backend calls `registerMediaArtifact()`:
   - Generates UUID `artifactId` 
   - Creates in-memory store entry: `mediaArtifactStore.set(artifactId, {filePath, mimeType, extension, expiresAt})`
   - **TTL: 1 HOUR** ⏱️ (hardcoded, critical for cleanup)
   - Detects MIME type from response headers (audio/mpeg, audio/wav, etc.)

### Phase 2: Artifact Serving

Endpoint: **`GET /api/media/ffmpeg/artifacts/{artifactId}`**

Behavior:
1. Looks up `artifactId` in `mediaArtifactStore` (in-memory Map)
2. Validates artifact hasn't expired (`record.expiresAt <= Date.now()`)
3. If expired: deletes from store, deletes temp file, returns 410 Gone
4. If valid: sets HTTP headers and serves file:
   - `Content-Type: {record.mimeType}` (e.g., audio/mpeg)
   - `Content-Length: {filesize}` (byte count)
   - `Cache-Control: private, max-age=300` (browser cache 5 minutes)
5. Returns 404 if artifact ID not found
6. Returns 410 if temp file unavailable

**Expiration Cleanup**: After 1 hour, artifact is automatically deleted from memory and temp file is unlinked.

### Phase 3: Frontend State Management

1. **Response Reception**: `handleGenerateAudio()` receives response with `audioUrl`:
   ```
   audioUrl: "http://localhost:3000/api/media/ffmpeg/artifacts/a1b2c3d4-e5f6-..."
   ```

2. **State Update**: Frontend calls `applyLiveRecord()` which updates React state:
   ```javascript
   afterAudio = audioUrl                                    // Store artifact URL
   afterAudioFormat = "mp3"                                 // Detected format
   afterAudioFileName = "generated-audio-{timestamp}.mp3"   // Auto-generated name
   isGenerating = false                                     // Indicate completion
   ```

3. **Playback Ready**: Web Audio API now has access to audio via HTTP fetch to artifact endpoint

### Phase 4: User Access Patterns

#### Pattern A: Play/Listen
- User clicks play button → Frontend fetches from `GET /api/media/ffmpeg/artifacts/{artifactId}`
- Browser decodes and plays via Web Audio API
- Must occur **within 1 hour** or artifact is gone

#### Pattern B: Export/Download
- User clicks "Export" → `handleExportAfterAudio()` triggers download:
  - Fetches from artifact URL
  - Infers audio format from response headers
  - Browser downloads to ~/Downloads/ with sanitized filename
  - Audio is now permanently saved locally ✅

#### Pattern C: Save Session
- User clicks "Save Session" → `handleSaveSession()` stores to localStorage:
  ```javascript
  savedSession = {
    id: uuid,
    timestamp: Date.now(),
    beforeAudio: beforeAudioDataUrl,    // Base64 encoded original upload
    afterAudio: afterAudio,             // Artifact URL (snapshot at save time)
    beforeAudioDataUrl: beforeAudioDataUrl,  // Full audio data as data URL
    versionA: {...},                    // Dial snapshots
    versionB: {...},
    fxControls: {...}                   // Effect settings
  }
  ```

#### Pattern D: Load Session
- User clicks "Load Session" → `handleLoadSession()` restores from localStorage:
  - **Restores audio locally**: `beforeAudioDataUrl` is loaded directly into React state
  - **Restores dial snapshots**: `versionA`, `versionB` emotion/vocal settings are restored
  - **Restores FX settings**: Reverb, EQ, compression, delay values restored
  - **✅ FULLY LOCAL**: No dependency on artifact endpoint or backend
  - Even if original artifact expired (>1 hour), session plays back the complete audio locally from stored data URL
  - **Restored session is immediately playable** without requiring generation or re-export
  
**Key Difference**: Unlike Pattern C, loaded sessions are **independent of artifact TTL** because audio data is stored as base64 within the session blob itself.

### Phase 5: Database Persistence (Optional)

If MySQL is configured, backend also writes request record to `pnf_request_jobs` table:
```sql
INSERT INTO pnf_request_jobs (
  request_id,
  generator,
  provider_job_id,
  prompt,
  payload,
  normalized_status,
  audio_url,                    -- Artifact URL or direct ElevenLabs URL
  created_at,
  updated_at
) VALUES (...)
```

This allows recovery of audio URLs even if artifact has expired, by querying provider for redownload.

### Timeline Summary

| Time | Status | Audio Location | Accessible |
|------|--------|-----------------|------------|
| T=0s | Generated | ElevenLabs API | ✅ Being downloaded |
| T=1s | Stored | /tmp/saion-elevenlabs-music-*.mp3 + mediaArtifactStore | ✅ Via artifact endpoint |
| T=30min | Stored | Same | ✅ Via artifact endpoint |
| T=59min | Stored | Same | ✅ Via artifact endpoint (1 min left) |
| T=60min | EXPIRED | Deleted from temp + store | ❌ 410 Gone response |
| T=61min+ | Gone | Lost unless exported or session saved | ❌ Must regenerate |

### Critical Implications for Production

1. **Do NOT rely on artifact URLs persisting**: Always export audio before leaving the app if you need to keep it
2. **Session saves capture URL, not audio**: Reloading a session >1 hour later will have dead artifact links
3. **Concurrent requests**: Each generation gets unique temp file and artifactId; multiple in-flight requests are isolated
4. **Storage limits**: In-memory store scales with concurrent users; consider external cache (Redis) for production
5. **Callback backups**: Database persistence provides secondary recovery path if artifact expires

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
