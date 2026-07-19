# ElevenLabs UI Instruction Guide

This guide explains how to run ElevenLabs generation from the SAION Generate page, including the hybrid prompt model and required backend configuration.

## Purpose

Use this when validating regular voicing through the UI while keeping music-focused notation and performance controls available.

## UI Prompt Model (Hybrid)

In `gui/src/App-new.jsx`:

1. `General Prompt (Text)` is hybrid input.
2. Performance dials provide contextual generation data.
3. `Prompt Fine-Tune (Music Notation)` is notation refinement context, not the primary text field.

Effective behavior:

- Generation prompt is constructed from dial-driven context plus `General Prompt` notes.
- Fine-tune notation is appended to notation export context.

## Generate Page Workflow

1. Open the app and navigate to the Generate page.
2. Confirm `Generator` is set to `ElevenLabs`.
3. Enter wording in `General Prompt (Text)`.
4. Optionally adjust Performance dials and notation fine-tune.
5. Click `Generate Audio`.
6. Wait for `GENERATING` state to complete.
7. Confirm returned audio appears in the `After` section and is playable.

## Required Environment Variables

Set these in deployment environment (or local `.env`):

```env
ELEVENLABS_API_KEY=...
ELEVENLABS_BASE_URL=https://api.elevenlabs.io
ELEVENLABS_GENERATE_PATH=/v1/text-to-speech/{voiceId}
ELEVENLABS_STATUS_PATH=/v1/jobs/{jobId}
ELEVENLABS_VOICE_ID=TX3LPaxmHKxFdv7VOQHJ
```

Notes:

- `ELEVENLABS_VOICE_ID` can be changed to any valid voice ID.
- Key material must remain server-side only.

## API Path Used by UI

The UI calls backend routes:

1. `POST /api/apiframe/generate`
2. `GET /api/apiframe/status/:jobId`

Generator value sent by UI is normalized to canonical provider IDs (`elevenlabs`, `mureka`, `udio`, `suno`).

## Deployment Validation (DigitalOcean)

Run these checks against deployed host:

```bash
curl "https://saionapp-qsqlp.ondigitalocean.app/api/apiframe/health?generator=elevenlabs"
```

Expected:

- `ok: true`
- checks for `apiKey`, `baseUrl`, `generatePath`, `statusPath` all true

## Troubleshooting

### Generate button fails immediately

1. Confirm backend is reachable from frontend origin.
2. Confirm health endpoint returns `ok: true` for `generator=elevenlabs`.
3. Confirm `General Prompt` is not empty.

### Health endpoint is not ready

1. Verify env vars are set in deployment dashboard.
2. Redeploy service after env updates.

### No audio URL after request

1. Check backend logs for upstream provider errors.
2. Verify voice ID is valid for the API key account.
3. Re-test via `npm run test:elevenlabs` from project root.

## QA Checklist

1. Enter only text in `General Prompt` and generate successfully.
2. Enter text + dial changes and generate successfully.
3. Add notation fine-tune and verify generation still succeeds.
4. Verify generated audio is playable in UI transport controls.
5. Verify session export summary includes General Prompt and notation details.
