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
